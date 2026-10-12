package local.piggy.playground;

import java.security.MessageDigest;

public final class UpdatePolicyTests {
    private static int passed;
    private static final String URL = "https://github.com/tzlh6/piggy-playground/releases/download/v4.4.1/PiggyPlayground-4.4.1-Android.apk";
    private static final String HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static void reject(Runnable action) {
        try { action.run(); throw new AssertionError("Invalid update accepted"); }
        catch (IllegalArgumentException expected) { passed++; }
    }
    public static void main(String[] args) throws Exception {
        UpdatePolicy.validate("4.4.1", 40401, 2000000, HASH, URL); passed++;
        for (String invalid : new String[]{"http://github.com/tzlh6/piggy-playground/releases/download/v4.4.1/test.apk",
                URL.replace("github.com", "evil.test"), URL.replace("tzlh6", "other"),
                URL.replace("piggy-playground", "other"), URL.replace("github.com", "github.com@evil.test"),
                URL.replace("github.com", "github.com:444"), URL + "?file=evil", URL + "#evil",
                URL.replace(".apk", ".exe"), URL.replace("v4.4.1/", "../../"),
                URL.replace("github.com", "github.com.evil.test")})
            reject(() -> UpdatePolicy.validate("4.4.1", 40401, 2000000, HASH, invalid));
        reject(() -> UpdatePolicy.validate("4.4.1", 40200, 2000000, HASH, URL));
        reject(() -> UpdatePolicy.validate("4.4.1", 40401, 0, HASH, URL));
        reject(() -> UpdatePolicy.validate("4.4.1", 40401, UpdatePolicy.MAX_APK_BYTES + 1, HASH, URL));
        reject(() -> UpdatePolicy.validate("4.4.1", 40401, 2000000, "fake", URL));
        reject(() -> UpdatePolicy.validate("4.4.1<script>", 40401, 2000000, HASH, URL));
        reject(() -> UpdatePolicy.validate("4.100.1", 50001, 2000000, HASH, URL));
        byte[] data = "piggy update".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
        String sha = UpdatePolicy.hex(digest);
        UpdatePolicy.verifyDigest(data.length, data.length, digest, sha); passed++;
        UpdatePolicy.verifyDigest(data.length, data.length, digest, sha.toUpperCase()); passed++;
        reject(() -> UpdatePolicy.verifyDigest(data.length, data.length + 1, digest, sha));
        reject(() -> UpdatePolicy.verifyDigest(data.length, data.length, digest, HASH));
        for (String host : new String[]{"github.com", "api.github.com", "raw.githubusercontent.com", "cdn.jsdelivr.net", "fastly.jsdelivr.net", "gcore.jsdelivr.net", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}) {
            if (!UpdatePolicy.allowedHost("https://" + host + "/test")) throw new AssertionError(host); passed++;
        }
        for (String bad : new String[]{"http://github.com/x", "https://evil.test/x", "https://github.com:444/x", "https://evil@github.com/x", "https://github.com.evil.test/x"}) {
            if (UpdatePolicy.allowedHost(bad)) throw new AssertionError(bad); passed++;
        }
        System.out.println("PASS: " + passed + " updater boundary checks (source, HTTPS, version, size, SHA-256, redirects)");
    }
}
