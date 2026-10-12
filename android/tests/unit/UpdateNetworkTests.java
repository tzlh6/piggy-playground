package local.piggy.playground;

import java.io.IOException;
import java.net.ConnectException;
import java.util.concurrent.atomic.AtomicBoolean;

public final class UpdateNetworkTests {
    private static int passed;
    private static final UpdateNetwork.Route[] ROUTES = {
        new UpdateNetwork.Route("blocked", "https://github.com/a", "application/json"),
        new UpdateNetwork.Route("mirror", "https://gcore.jsdelivr.net/a", "application/json"),
        new UpdateNetwork.Route("newest", "https://api.github.com/a", "application/json")
    };
    private static void check(boolean value, String label) {
        if (!value) throw new AssertionError(label); passed++;
    }
    public static void main(String[] args) throws Exception {
        UpdateNetwork.Selection<Long> fallback = UpdateNetwork.select(ROUTES, route -> {
            if ("mirror".equals(route.name)) return 40402L;
            throw new ConnectException("Failed to connect to cdn.jsdelivr.net/104.17.207.5:443");
        }, value -> value, 500);
        check(fallback.value == 40402 && "mirror".equals(fallback.source), "blocked routes do not hide successful mirror");
        UpdateNetwork.Selection<Long> fresh = UpdateNetwork.select(ROUTES, route -> {
            if ("newest".equals(route.name)) { Thread.sleep(60); return 40402L; }
            if ("mirror".equals(route.name)) return 40401L;
            throw new IllegalArgumentException("malformed manifest");
        }, value -> value, 500);
        check(fresh.value == 40402, "newer response beats a fast stale mirror");
        AtomicBoolean interrupted = new AtomicBoolean();
        long start = System.nanoTime();
        UpdateNetwork.Selection<Long> bounded = UpdateNetwork.select(ROUTES, route -> {
            if ("mirror".equals(route.name)) return 40402L;
            try { Thread.sleep(5000); } catch (InterruptedException stop) { interrupted.set(true); throw stop; }
            return 1L;
        }, value -> value, 100);
        check(bounded.value == 40402 && (System.nanoTime() - start) / 1000000 < 800, "global deadline bounds blocked routes");
        for (int retry = 0; retry < 50 && !interrupted.get(); retry++) Thread.sleep(10);
        check(interrupted.get(), "pending routes are cancelled");
        try {
            UpdateNetwork.select(ROUTES, route -> { throw new IOException("404"); }, value -> 1, 500);
            throw new AssertionError("all failed routes accepted");
        } catch (IOException expected) { check(expected.getMessage().contains("暂时连不上"), "all failures have a usable Chinese message"); }
        for (Exception error : new Exception[]{new ConnectException("Failed to connect to 104.17.207.5:443"),
                new java.net.UnknownHostException("cdn.jsdelivr.net"), new java.net.SocketTimeoutException("read timed out"),
                new javax.net.ssl.SSLHandshakeException("Certificate verify failed"), new IOException("Connection reset")}) {
            String message = UpdateNetwork.message(error);
            check(message.matches(".*[\\u4e00-\\u9fff].*") && !message.contains("104.17") && !message.contains("Failed"), "raw network errors are translated");
        }
        check(UpdateNetwork.message(new IOException("安装包签名与当前应用不同，已拒绝安装")).contains("签名"), "validation failures remain precise");
        try (UpdateNetwork network = new UpdateNetwork()) {
            try { network.text("https://github.com.evil.test/x", "application/json", 64); throw new AssertionError("foreign route allowed"); }
            catch (IOException expected) { check(expected.getMessage().contains("不受信任"), "TLS host allowlist precedes networking"); }
        }
        System.out.println("PASS: " + passed + " network regression checks");
        if (args.length > 0 && "--live".equals(args[0])) {
            try (UpdateNetwork network = new UpdateNetwork()) {
                for (UpdateNetwork.Route route : UpdateNetwork.MANIFESTS) {
                    String body = network.text(route.url, route.accept, 65536);
                    check(body.contains("\"schema\": 1") && body.contains("\"package\": \"local.piggy.playground\""), route.name + " live manifest");
                    System.out.println("LIVE PASS: " + route.name);
                }
            }
        }
    }
}
