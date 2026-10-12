package local.piggy.playground;

import java.net.URI;
import java.security.MessageDigest;

/** Shared by the native downloader and the SDK-free boundary tests. */
public final class UpdatePolicy {
    public static final long MAX_APK_BYTES = 64L * 1024 * 1024;
    public static final String RELEASES = "https://github.com/tzlh6/piggy-playground/releases";
    private UpdatePolicy() {}

    public static void validate(String version, long code, long bytes, String sha, String url) {
        if (version == null || !version.matches("[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"))
            throw new IllegalArgumentException("版本号无效");
        String[] parts = version.split("\\.");
        int major = Integer.parseInt(parts[0]), minor = Integer.parseInt(parts[1]), patch = Integer.parseInt(parts[2]);
        if (minor > 99 || patch > 99 || code != major * 10000L + minor * 100L + patch || code <= 0)
            throw new IllegalArgumentException("版本编号不一致");
        if (bytes <= 0 || bytes > MAX_APK_BYTES || sha == null || !sha.matches("[a-fA-F0-9]{64}"))
            throw new IllegalArgumentException("更新文件大小或校验值无效");
        URI uri = secureUri(url);
        if (!"github.com".equals(uri.getHost()) || uri.getRawQuery() != null ||
            !uri.getRawPath().matches("/tzlh6/piggy-playground/releases/download/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+\\.apk"))
            throw new IllegalArgumentException("更新文件必须来自本项目的 GitHub Release");
    }

    public static URI secureUri(String url) {
        URI uri = URI.create(url);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getRawUserInfo() != null ||
            (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawFragment() != null)
            throw new IllegalArgumentException("只允许 HTTPS 更新地址");
        return uri;
    }

    public static boolean allowedHost(String url) {
        try {
            String host = secureUri(url).getHost();
            return "github.com".equals(host) || "raw.githubusercontent.com".equals(host) ||
                "api.github.com".equals(host) || "cdn.jsdelivr.net".equals(host) ||
                "fastly.jsdelivr.net".equals(host) || "gcore.jsdelivr.net".equals(host) ||
                "release-assets.githubusercontent.com".equals(host) ||
                "objects.githubusercontent.com".equals(host);
        } catch (RuntimeException invalid) { return false; }
    }

    public static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 255));
        return result.toString();
    }

    public static void verifyDigest(long actual, long expected, byte[] hash, String sha) {
        if (actual != expected || !MessageDigest.isEqual(hex(hash).getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                sha.toLowerCase(java.util.Locale.ROOT).getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
            throw new IllegalArgumentException("安装包校验未通过，请重新下载");
    }
}
