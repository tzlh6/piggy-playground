package local.piggy.playground;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Exercises the actual packaged page under a constrained JVM heap. */
public class StartupPageTests {
    public static void main(String[] args) throws Exception {
        try (InputStream input = new FileInputStream(args[0])) {
            String html = StartupPage.read(input);
            byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
            StringBuilder digest = new StringBuilder();
            for (byte part : MessageDigest.getInstance("SHA-256").digest(bytes)) digest.append(String.format("%02x", part & 255));
            if (!args[1].equals(digest.toString())) throw new AssertionError("Startup HTML changed during decoding");
            if (html.contains("type=\"application/json\" id=\"pig-engine-")) throw new AssertionError("Large engines in startup heap");
            System.out.println("PASS actual startup page: " + bytes.length + " bytes, exact UTF-8 content, no inline engine packs");
        }
        reject(new ByteArrayInputStream(new byte[0]));
        reject(new InputStream() {
            private int remaining = StartupPage.MAX_BYTES + 1;
            public int read() { return remaining-- > 0 ? 65 : -1; }
            public int read(byte[] buffer, int offset, int count) {
                if (remaining <= 0) return -1;
                count = Math.min(count, remaining); remaining -= count; return count;
            }
        });
        System.out.println("PASS empty and oversized startup pages rejected without loading engines");
    }
    private static void reject(InputStream input) throws Exception {
        try { StartupPage.read(input); throw new AssertionError("Invalid startup page accepted"); }
        catch (IOException expected) { }
    }
}
