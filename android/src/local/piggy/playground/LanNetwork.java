package local.piggy.playground;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.json.JSONArray;
import org.json.JSONObject;

/** Bounded, native LAN transport. Compatible with desktop piggy-lan/1 (TCP + UDP).
 * Game rules and seat-specific views live in the packaged page, never in a relay.
 * No DNS lookup, URL loading, port forwarding or external address is accepted.
 */
public final class LanNetwork implements AutoCloseable {
    public interface Listener { void event(JSONObject event); }
    public static final int DISCOVERY_PORT = 47320, TCP_PORT = 47321, MAX_LINE = 256 * 1024;
    private static final String PROTOCOL = "piggy-lan/1";
    private final Listener listener;
    private final int discoveryPort, firstPort;
    private final ExecutorService workers = Executors.newCachedThreadPool(r -> daemon(r, "PiggyLanIO"));
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> daemon(r, "PiggyLanClock"));
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();
    private final Map<String, JSONObject> rooms = new ConcurrentHashMap<>();
    private volatile ServerSocket server;
    private volatile DatagramSocket responder, scanner;
    private volatile Peer client;
    private volatile JSONObject room;
    private volatile int port, generation;
    private int serial;
    private volatile boolean closed;

    public LanNetwork(Listener listener) { this(listener, DISCOVERY_PORT, TCP_PORT); }
    public LanNetwork(Listener listener, int discoveryPort, int firstPort) {
        this.listener = listener; this.discoveryPort = discoveryPort; this.firstPort = firstPort;
        timer.scheduleAtFixedRate(this::heartbeat, 4, 4, TimeUnit.SECONDS);
        timer.scheduleAtFixedRate(this::query, 0, 1200, TimeUnit.MILLISECONDS);
    }
    private static Thread daemon(Runnable r, String name) { Thread t = new Thread(r, name); t.setDaemon(true); return t; }
    static JSONObject json(Object... pairs) {
        JSONObject out = new JSONObject();
        try { for (int i = 0; i < pairs.length; i += 2) out.put((String)pairs[i], pairs[i + 1]); }
        catch (Exception ignored) { }
        return out;
    }
    private void emit(JSONObject event) { if (!closed) listener.event(event); }
    private static String text(JSONObject o, String k, int limit) { String s = o.optString(k, ""); return s.substring(0, Math.min(limit, s.length())); }
    private static int count(JSONObject o, String k) { return Math.max(0, Math.min(9, o.optInt(k, 0))); }
    private static JSONObject cleanRoom(JSONObject o) {
        if (o == null) o = new JSONObject();
        return json("name", text(o, "name", 30), "game", text(o, "game", 20), "players", count(o, "players"),
            "seats", count(o, "seats"), "open", count(o, "open"), "rejoin", count(o, "rejoin"),
            "state", text(o, "state", 16), "version", text(o, "version", 16), "proto", text(o, "proto", 16));
    }
    static InetAddress localAddress(String host) throws IOException {
        if (host == null || !host.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) throw new IOException("请输入房主显示的 IPv4 地址");
        String[] parts = host.split("\\."); byte[] bytes = new byte[4];
        for (int i = 0; i < 4; i++) { int n = Integer.parseInt(parts[i]); if (n > 255) throw new IOException("地址格式不对"); bytes[i] = (byte)n; }
        InetAddress a = InetAddress.getByAddress(bytes);
        if (!(a.isSiteLocalAddress() || a.isLinkLocalAddress() || a.isLoopbackAddress()) || a.isAnyLocalAddress() || a.isMulticastAddress())
            throw new IOException("请使用同一 Wi-Fi 或热点内的局域网地址");
        return a;
    }
    private static List<InterfaceAddress> interfaces() {
        List<InterfaceAddress> out = new ArrayList<>();
        try { for (NetworkInterface n : Collections.list(NetworkInterface.getNetworkInterfaces())) {
            if (!n.isUp() || n.isLoopback()) continue;
            for (InterfaceAddress a : n.getInterfaceAddresses()) if (a.getAddress() instanceof Inet4Address) out.add(a);
        } } catch (Exception ignored) { }
        return out;
    }
    private static JSONArray addresses() {
        JSONArray out = new JSONArray();
        for (InterfaceAddress a : interfaces()) if (a.getAddress().isSiteLocalAddress() || a.getAddress().isLinkLocalAddress()) out.put(a.getAddress().getHostAddress());
        return out;
    }
    public JSONObject info() { return json("hosting", server != null, "joined", client != null, "port", port,
        "addrs", addresses(), "peers", new JSONArray(peers.keySet()), "scanning", scanner != null); }
    public synchronized JSONObject host(JSONObject data) {
        leave(); if (closed) return json("ok", false, "error", "联机模块已关闭");
        room = cleanRoom(data);
        for (int p = firstPort; p < firstPort + 10; p++) {
            ServerSocket candidate = null;
            try { candidate = new ServerSocket(); candidate.setReuseAddress(true); candidate.bind(new InetSocketAddress(p)); server = candidate; port = p; break; }
            catch (IOException ignored) { if (candidate != null) try { candidate.close(); } catch (IOException alsoIgnored) { } }
        }
        if (server == null) return json("ok", false, "error", "建房端口被占用，请关闭其他房间后重试");
        final int gen = generation; final ServerSocket s = server;
        workers.execute(() -> {
            while (!closed && server == s && generation == gen) {
                try {
                    Socket sock = s.accept();
                    synchronized (this) {
                        InetAddress remote = sock.getInetAddress();
                        if (server != s || generation != gen || peers.size() >= 6 ||
                            !(remote.isSiteLocalAddress() || remote.isLinkLocalAddress() || remote.isLoopbackAddress())) { sock.close(); continue; }
                        String id = "p" + (++serial); Peer peer = new Peer(sock, id, gen); peers.put(id, peer);
                        emit(json("type", "peer", "id", id, "addr", sock.getInetAddress().getHostAddress())); peer.start();
                    }
                } catch (IOException error) { break; }
            }
        });
        try {
            DatagramSocket u = new DatagramSocket(null); u.setReuseAddress(true); u.bind(new InetSocketAddress(discoveryPort)); responder = u;
            workers.execute(() -> receiveRooms(u, true, gen));
        } catch (IOException ignored) { responder = null; }
        return json("ok", true, "port", port, "addrs", addresses(), "discovery", responder != null);
    }
    public boolean setRoom(JSONObject data) { room = cleanRoom(data); return true; }
    public synchronized JSONObject join(String host, int requestedPort) {
        leave(); if (closed) return json("ok", false, "error", "联机模块已关闭");
        Socket sock = new Socket();
        try {
            InetAddress address = localAddress(host); int p = requestedPort == 0 ? firstPort : requestedPort;
            if (p < 1 || p > 65535) throw new IOException("端口应在 1–65535 之间");
            sock.connect(new InetSocketAddress(address, p), 6000);
            Peer peer = new Peer(sock, "host", generation); client = peer; peer.start();
            return json("ok", true, "host", host, "port", p);
        } catch (Exception error) {
            try { sock.close(); } catch (IOException ignored) { }
            return json("ok", false, "error", error instanceof SocketTimeoutException ? "timeout" :
                error instanceof ConnectException ? "ECONNREFUSED" : error.getMessage());
        }
    }
    public synchronized boolean scan(boolean on) {
        if (!on) { DatagramSocket u = scanner; scanner = null; if (u != null) u.close(); rooms.clear(); return true; }
        if (closed) return false;
        if (scanner != null) return true;
        try { DatagramSocket u = new DatagramSocket(); u.setBroadcast(true); scanner = u;
            workers.execute(() -> receiveRooms(u, false, 0)); query(); return true;
        } catch (IOException error) { emit(json("type", "error", "error", "无法查找房间，请检查 Wi-Fi 或使用地址加入")); return false; }
    }
    private void receiveRooms(DatagramSocket u, boolean host, int gen) {
        byte[] bytes = new byte[4097];
        while (!closed && !u.isClosed()) {
            try {
                DatagramPacket p = new DatagramPacket(bytes, bytes.length); u.receive(p);
                if (p.getLength() > (host ? 512 : 4096)) continue;
                InetAddress from = p.getAddress(); if (!(from.isSiteLocalAddress() || from.isLinkLocalAddress() || from.isLoopbackAddress())) continue;
                JSONObject m = new JSONObject(new String(p.getData(), p.getOffset(), p.getLength(), StandardCharsets.UTF_8));
                if (!PROTOCOL.equals(m.optString("proto"))) continue;
                if (host && "q".equals(m.optString("t")) && generation == gen && room != null && server != null) {
                    byte[] reply = json("proto", PROTOCOL, "t", "room", "port", port, "room", room).toString().getBytes(StandardCharsets.UTF_8);
                    u.send(new DatagramPacket(reply, reply.length, from, p.getPort()));
                } else if (!host && scanner == u && "room".equals(m.optString("t"))) {
                    int rp = m.optInt("port"); if (rp < 1 || rp > 65535) continue;
                    String ip = from.getHostAddress(); JSONObject r = cleanRoom(m.optJSONObject("room"));
                    rooms.put(ip + ":" + rp, json("host", ip, "port", rp, "room", r, "seen", System.currentTimeMillis())); pushRooms();
                }
            } catch (Exception ignored) { if (u.isClosed()) break; }
        }
    }
    private void query() {
        DatagramSocket u = scanner; if (u == null || u.isClosed() || closed) return;
        byte[] data = json("proto", PROTOCOL, "t", "q").toString().getBytes(StandardCharsets.UTF_8);
        Set<String> targets = new HashSet<>(Arrays.asList("255.255.255.255", "127.0.0.1"));
        for (InterfaceAddress a : interfaces()) if (a.getBroadcast() != null) targets.add(a.getBroadcast().getHostAddress());
        for (String ip : targets) try { u.send(new DatagramPacket(data, data.length, InetAddress.getByName(ip), discoveryPort)); } catch (Exception ignored) { }
        long now = System.currentTimeMillis(); boolean changed = rooms.entrySet().removeIf(e -> now - e.getValue().optLong("seen") > 4500);
        if (changed) pushRooms();
    }
    private void pushRooms() {
        JSONArray list = new JSONArray(), mine = addresses(); Set<String> own = new HashSet<>();
        for (int i = 0; i < mine.length(); i++) own.add(mine.optString(i));
        for (JSONObject r : rooms.values()) {
            String ip = r.optString("host");
            if (ip.equals("127.0.0.1") && rooms.values().stream().anyMatch(x -> x.optInt("port") == r.optInt("port") && own.contains(x.optString("host")))) continue;
            list.put(json("host", ip, "port", r.optInt("port"), "room", r.optJSONObject("room"), "local", ip.equals("127.0.0.1") || own.contains(ip)));
        }
        emit(json("type", "rooms", "list", list));
    }
    public boolean send(String to, JSONObject message) {
        String text = message.toString(); if (text.getBytes(StandardCharsets.UTF_8).length > MAX_LINE) return false;
        Peer c = client; if (c != null) return c.send(text);
        if (server == null) return false;
        if ("*".equals(to)) { for (Peer peer : peers.values()) peer.send(text); return true; }
        Peer peer = peers.get(to); return peer != null && peer.send(text);
    }
    public boolean kick(String id) { Peer peer = peers.get(id); if (peer == null) return false; timer.schedule(peer::stop, 120, TimeUnit.MILLISECONDS); return true; }
    private void heartbeat() {
        for (Peer p : peers.values()) p.ping(); Peer p = client; if (p != null) p.ping();
    }
    public synchronized boolean leave() {
        generation++; ServerSocket s = server; server = null; port = 0; room = null;
        if (s != null) try { s.close(); } catch (IOException ignored) { }
        DatagramSocket u = responder; responder = null; if (u != null) u.close();
        Peer c = client; client = null; if (c != null) c.stop();
        for (Peer p : peers.values()) p.stop(); peers.clear(); return true;
    }
    @Override public synchronized void close() { if (closed) return; closed = true; scan(false); leave(); timer.shutdownNow(); workers.shutdownNow(); }
    private final class Peer {
        final Socket socket; final String id; final int gen;
        final ThreadPoolExecutor writes = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(64), r -> daemon(r, "PiggyLanWrite"));
        volatile long last = System.currentTimeMillis(); boolean stopped;
        Peer(Socket s, String id, int gen) throws IOException { this.socket = s; this.id = id; this.gen = gen;
            s.setTcpNoDelay(true); s.setKeepAlive(true); s.setSoTimeout(21000); }
        void start() { workers.execute(this::read); }
        void read() {
            try { InputStream input = socket.getInputStream(); ByteArrayOutputStream line = new ByteArrayOutputStream(); byte[] data = new byte[4096]; int n;
                while ((n = input.read(data)) >= 0 && !stopped && gen == generation) {
                    last = System.currentTimeMillis();
                    for (int i = 0; i < n; i++) {
                        if (data[i] == '\n') {
                            if (line.size() > 0) {
                                try { JSONObject m = new JSONObject(new String(line.toByteArray(), StandardCharsets.UTF_8));
                                    if (!"~ping".equals(m.optString("t")) && !stopped && gen == generation) emit(json("type", "msg", "from", id, "msg", m));
                                } catch (Exception ignored) { }
                            }
                            line.reset();
                        } else { if (line.size() >= MAX_LINE) throw new IOException("oversize"); line.write(data[i]); }
                    }
                }
            } catch (IOException ignored) { } finally { stop(); }
        }
        synchronized boolean send(String text) {
            if (stopped || gen != generation) return false;
            byte[] bytes = (text + "\n").getBytes(StandardCharsets.UTF_8);
            try { writes.execute(() -> { try { socket.getOutputStream().write(bytes); socket.getOutputStream().flush(); } catch (IOException error) { stop(); } }); return true; }
            catch (RejectedExecutionException error) { stop(); return false; }
        }
        void ping() { if (System.currentTimeMillis() - last > 20000) stop(); else send("{\"t\":\"~ping\"}"); }
        synchronized void stop() {
            if (stopped) return; stopped = true; try { socket.close(); } catch (IOException ignored) { } writes.shutdownNow();
            if (gen != generation || closed) return;
            if ("host".equals(id) && client == this) { client = null; emit(json("type", "closed", "reason", "连接断开，请重新加入房间")); }
            else if (peers.remove(id, this)) emit(json("type", "peer-left", "id", id, "reason", "closed"));
        }
    }
}
