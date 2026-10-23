package local.piggy.playground;

import java.io.ByteArrayOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PushbackInputStream;
import java.nio.charset.Charset;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Reads selected JSON files or ZIP members without extracting archive paths. */
public final class StudyBankImporter {
    public static final long MAX_BANK_BYTES = 120L * 1024 * 1024;
    private static final Limits DEFAULT = new Limits(MAX_BANK_BYTES, MAX_BANK_BYTES, 256L * 1024 * 1024, 1000);

    public interface Receiver {
        /** Stage one bank. Return false when it is not a valid study bank. */
        boolean receive(String name, byte[] data) throws IOException;
    }

    public static final class Result {
        public int accepted, skipped;
    }

    static final class Limits {
        final long bank, source, unpacked;
        final int entries;
        Limits(long bank, long source, long unpacked, int entries) {
            this.bank = bank; this.source = source; this.unpacked = unpacked; this.entries = entries;
        }
    }

    public static Result read(InputStream input, String name, Receiver receiver) throws IOException {
        return read(input, name, receiver, DEFAULT);
    }

    static Result read(InputStream input, String name, Receiver receiver, Limits limits) throws IOException {
        if (input == null) throw new IOException("无法打开选中的文件，请重新选择。");
        String lower = String.valueOf(name).toLowerCase(Locale.ROOT);
        if (lower.endsWith(".rar") || lower.endsWith(".7z"))
            throw new IOException("请使用 ZIP 压缩包，暂不支持 RAR 或 7Z。");
        Result result = new Result();
        try (PushbackInputStream source = new PushbackInputStream(new BoundedInput(input, limits.source), 4)) {
            byte[] magic = new byte[4];
            int got = 0, n;
            while (got < magic.length && (n = source.read(magic, got, magic.length - got)) > 0) got += n;
            source.unread(magic, 0, got);
            boolean zip = got == 4 && magic[0] == 'P' && magic[1] == 'K' &&
                ((magic[2] == 3 && magic[3] == 4) || (magic[2] == 5 && magic[3] == 6));
            if (!zip) {
                if (lower.endsWith(".zip")) throw new IOException("压缩包无法读取，请选择未加密的 ZIP 文件。");
                if (receiver.receive(leaf(name), bytes(source, limits.bank, null))) result.accepted++;
                else result.skipped++;
                return result;
            }
            // UTF-8 ZIPs carry their own flag; otherwise accept common Chinese Windows filenames.
            try (ZipInputStream archive = new ZipInputStream(source, Charset.forName("GB18030"))) {
                int entries = 0;
                long[] budget = {limits.unpacked};
                ZipEntry entry;
                while ((entry = archive.getNextEntry()) != null) {
                    if (++entries > limits.entries) throw new IOException("压缩包内文件过多，请按学科分包导入。");
                    boolean candidate = !entry.isDirectory() && safeJson(entry.getName());
                    byte[] data = bytes(archive, candidate ? limits.bank : limits.unpacked, budget, candidate);
                    archive.closeEntry(); // Verify CRC before staging this member.
                    if (!candidate) continue;
                    if (receiver.receive(leaf(entry.getName()), data)) result.accepted++;
                    else result.skipped++;
                }
            } catch (IllegalArgumentException error) {
                throw new IOException("压缩包的文件名编码无法读取，请重新压缩为 ZIP。", error);
            }
        }
        return result;
    }

    private static boolean safeJson(String name) {
        if (name == null) return false;
        String normalized = name.replace('\\', '/');
        if (normalized.startsWith("/") || normalized.matches("^[A-Za-z]:.*")) return false;
        for (String part : normalized.split("/"))
            if (part.equals("..") || part.equals(".") || part.equals("__MACOSX") || part.startsWith("._")) return false;
        return normalized.toLowerCase(Locale.ROOT).endsWith(".json");
    }

    private static String leaf(String name) {
        if (name == null) return "题库.json";
        String normalized = name.replace('\\', '/');
        return normalized.substring(normalized.lastIndexOf('/') + 1);
    }

    private static byte[] bytes(InputStream input, long limit, long[] budget) throws IOException {
        return bytes(input, limit, budget, true);
    }

    private static byte[] bytes(InputStream input, long limit, long[] budget, boolean retain) throws IOException {
        ByteArrayOutputStream output = retain ? new ByteArrayOutputStream() : null;
        byte[] buffer = new byte[65536];
        long total = 0;
        int n;
        while ((n = input.read(buffer)) != -1) {
            total += n;
            if (total > limit) throw new IOException("文件解压后过大，请按学科分包导入。");
            if (budget != null && (budget[0] -= n) < 0)
                throw new IOException("压缩包解压后过大，请按学科分包导入。");
            if (retain) output.write(buffer, 0, n);
        }
        return retain ? output.toByteArray() : null;
    }

    private static final class BoundedInput extends FilterInputStream {
        private final long limit;
        private long read;
        BoundedInput(InputStream input, long limit) { super(input); this.limit = limit; }
        private void count(int n) throws IOException {
            if (n > 0 && (read += n) > limit) throw new IOException("选中的文件过大，请按学科分包导入。");
        }
        @Override public int read() throws IOException {
            int b = in.read(); if (b >= 0) count(1); return b;
        }
        @Override public int read(byte[] b, int off, int len) throws IOException {
            int n = in.read(b, off, len); count(n); return n;
        }
    }
}
