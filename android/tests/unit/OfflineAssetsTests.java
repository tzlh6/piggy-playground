package local.piggy.playground;

public final class OfflineAssetsTests {
    private static void equal(Object expected, Object actual) {
        if (expected == null ? actual != null : !expected.equals(actual))
            throw new AssertionError("Expected " + expected + ", got " + actual);
    }
    public static void main(String[] args) {
        equal("game.html", OfflineAssets.path(OfflineAssets.ORIGIN + "game.html"));
        equal("assets/engines/pikafish/part-23.js", OfflineAssets.path(OfflineAssets.ORIGIN + "assets/engines/pikafish/part-23.js"));
        for (String engine : new String[]{"stockfish", "pikafish", "rapfi", "egaroucid"})
            equal("assets/engines/" + engine + "/part-0.js", OfflineAssets.path(OfflineAssets.ORIGIN + "assets/engines/" + engine + "/part-0.js"));
        for (String url : new String[]{
            "http://appassets.androidplatform.net/game.html", "file:///data/user/0/local.piggy.playground/files/study/a.json",
            "https://example.com/game.html", "https://appassets.androidplatform.net.evil.test/game.html",
            "https://appassets.androidplatform.net@evil.test/game.html", "https://u@appassets.androidplatform.net/game.html",
            "https://appassets.androidplatform.net:444/game.html", OfflineAssets.ORIGIN + "game.html?path=private",
            OfflineAssets.ORIGIN + "../game.html", OfflineAssets.ORIGIN + "%2e%2e/game.html",
            OfflineAssets.ORIGIN + "assets/engines/pikafish/../../study/a.json",
            OfflineAssets.ORIGIN + "assets/engines/pikafish/part-0.js%2f..%2fprivate",
            OfflineAssets.ORIGIN + "assets/engines/other/part-0.js", OfflineAssets.ORIGIN + "study/a.json", "not a URL", ""})
            equal(null, OfflineAssets.path(url));
        equal("text/html", OfflineAssets.mime("game.html"));
        equal("application/javascript", OfflineAssets.mime("assets/engines/pikafish/part-0.js"));
        System.out.println("PASS offline asset origin, traversal, private-file isolation, and MIME checks");
    }
}
