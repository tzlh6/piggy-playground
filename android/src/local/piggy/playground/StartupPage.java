package local.piggy.playground;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/** Only the small startup document is decoded; large engine packs remain streamed. */
public final class StartupPage {
    public static final int MAX_BYTES = 6 * 1024 * 1024;
    private StartupPage() { }

    public static String read(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (count > MAX_BYTES - output.size()) throw new IOException("Startup page exceeds 6 MiB");
            output.write(buffer, 0, count);
        }
        if (output.size() == 0) throw new IOException("Startup page is empty");
        return new String(output.toByteArray(), StandardCharsets.UTF_8);
    }
}
