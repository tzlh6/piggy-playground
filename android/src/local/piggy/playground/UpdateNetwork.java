package local.piggy.playground;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/** Bounded HTTPS requests using the platform's normal certificate verification. */
public final class UpdateNetwork implements AutoCloseable {
    public static final class Route {
        public final String name, url, accept;
        public Route(String name, String url, String accept) {
            this.name = name; this.url = url; this.accept = accept;
        }
    }
    public static final Route[] MANIFESTS = {
        new Route("GitHub API", "https://api.github.com/repos/tzlh6/piggy-playground/contents/android/update.json?ref=main", "application/vnd.github.raw+json"),
        new Route("jsDelivr Gcore", "https://gcore.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json", "application/json"),
        new Route("jsDelivr Fastly", "https://fastly.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json", "application/json"),
        new Route("GitHub Raw", "https://raw.githubusercontent.com/tzlh6/piggy-playground/main/android/update.json", "application/json"),
        new Route("jsDelivr", "https://cdn.jsdelivr.net/gh/tzlh6/piggy-playground@main/android/update.json", "application/json")
    };
    public interface Loader<T> { T load(Route route) throws Exception; }
    public interface Version<T> { long code(T value) throws Exception; }
    public static final class Selection<T> {
        public final T value;
        public final String source;
        Selection(T value, String source) { this.value = value; this.source = source; }
    }
    private final Set<HttpsURLConnection> connections = ConcurrentHashMap.newKeySet();
    private volatile boolean closed;

    /** Ask all routes together; ignore invalid responses and prefer the newest valid manifest. */
    public static <T> Selection<T> select(Route[] routes, Loader<T> loader, Version<T> version,
                                         long timeoutMillis) throws Exception {
        ExecutorService requests = Executors.newFixedThreadPool(routes.length, task -> {
            Thread thread = new Thread(task, "piggy-update-route"); thread.setDaemon(true); return thread;
        });
        ExecutorCompletionService<Selection<T>> completed = new ExecutorCompletionService<>(requests);
        try {
            for (Route route : routes) completed.submit(() -> new Selection<>(loader.load(route), route.name));
            long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMillis);
            Selection<T> newest = null;
            long newestCode = -1;
            for (int remaining = routes.length; remaining > 0; remaining--) {
                long wait = deadline - System.nanoTime();
                if (wait <= 0) break;
                Future<Selection<T>> next = completed.poll(wait, TimeUnit.NANOSECONDS);
                if (next == null) break;
                try {
                    Selection<T> candidate = next.get();
                    long code = version.code(candidate.value);
                    if (code > newestCode) { newest = candidate; newestCode = code; }
                } catch (InterruptedException interrupted) {
                    throw interrupted;
                } catch (Exception invalid) {
                    // A blocked or malformed route must not hide a successful independent route.
                }
            }
            if (newest == null) throw new IOException("暂时连不上更新服务，请稍后重试，或打开 GitHub 下载页手动更新。");
            return newest;
        } finally { requests.shutdownNow(); }
    }

    public String text(String url, String accept, int limit) throws Exception {
        HttpsURLConnection connection = open(url, accept);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = input.read(buffer)) != -1) {
                if (closed || Thread.currentThread().isInterrupted()) throw new IOException("更新检查已中止");
                if (bytes.size() + count > limit) throw new IOException("更新服务响应过大");
                bytes.write(buffer, 0, count);
            }
            return new String(bytes.toByteArray(), java.nio.charset.StandardCharsets.UTF_8);
        } finally { disconnect(connection); }
    }

    public HttpsURLConnection open(String initial, String accept) throws Exception {
        String url = initial;
        for (int redirects = 0; redirects <= 5; redirects++) {
            if (closed || Thread.currentThread().isInterrupted()) throw new IOException("更新请求已中止");
            if (!UpdatePolicy.allowedHost(url)) throw new IOException("更新地址不受信任");
            HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
            connections.add(connection);
            connection.setConnectTimeout(5000); connection.setReadTimeout(6000);
            connection.setInstanceFollowRedirects(false); connection.setUseCaches(false);
            connection.setRequestProperty("User-Agent", "PiggyPlayground-Android");
            connection.setRequestProperty("Accept-Encoding", "identity");
            // Send API media headers only to GitHub's API, not to signed storage redirects.
            connection.setRequestProperty("Accept", "api.github.com".equals(new URL(url).getHost()) ? accept : "*/*");
            final int result;
            try {
                if (closed) throw new IOException("更新请求已中止");
                result = connection.getResponseCode();
            } catch (Exception error) { disconnect(connection); throw error; }
            if (result == 200) return connection;
            String location = connection.getHeaderField("Location");
            disconnect(connection);
            if ((result == 301 || result == 302 || result == 303 || result == 307 || result == 308) && location != null)
                url = new URL(new URL(url), location).toString();
            else throw new IOException(result == 404 ? "更新文件暂时未找到，请稍后重试" :
                result == 403 || result == 429 ? "更新服务访问频繁，请稍后重试" : "更新服务暂不可用，请稍后重试");
        }
        throw new IOException("更新地址跳转过多");
    }
    public void disconnect(HttpsURLConnection connection) {
        connections.remove(connection); connection.disconnect();
    }
    @Override public void close() {
        closed = true;
        for (HttpsURLConnection connection : connections) connection.disconnect();
        connections.clear();
    }

    public static String message(Exception error) {
        if (error instanceof java.net.UnknownHostException) return "当前网络无法找到更新服务器，请稍后重试。";
        if (error instanceof java.net.SocketTimeoutException) return "连接更新服务器超时，请稍后重试。";
        if (error instanceof java.net.ConnectException || error instanceof java.net.SocketException)
            return "当前网络无法连接更新服务器，请稍后重试。";
        if (error instanceof javax.net.ssl.SSLException) return "与更新服务器的安全连接未成功，请稍后重试。";
        String message = error.getMessage();
        // Our own validation errors are Chinese; never expose raw socket messages or IP addresses.
        if (message != null && message.length() < 180 && message.matches(".*[\\u4e00-\\u9fff].*")) return message;
        return "更新暂不可用，请稍后重试，或打开 GitHub 下载页手动更新。";
    }
}
