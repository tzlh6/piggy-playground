package local.piggy.playground;

import java.net.URI;

/** Only packaged public assets are reachable from the stable, private WebView origin. */
public final class OfflineAssets {
    public static final String ORIGIN = "https://appassets.androidplatform.net/";
    private OfflineAssets() { }

    public static String path(String url) {
        try {
            URI uri = new URI(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                !"appassets.androidplatform.net".equalsIgnoreCase(uri.getHost()) ||
                uri.getRawUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443) ||
                uri.getRawQuery() != null) return null;
            String path = uri.getRawPath();
            if ("/game.html".equals(path)) return "game.html";
            if (path != null && path.matches("/assets/engines/(stockfish|pikafish|rapfi|egaroucid)/part-[0-9]{1,3}\\.js"))
                return path.substring(1);
        } catch (Exception ignored) { }
        return null;
    }

    public static String mime(String path) {
        return path.endsWith(".html") ? "text/html" : "application/javascript";
    }
}
