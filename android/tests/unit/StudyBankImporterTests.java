package local.piggy.playground;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public final class StudyBankImporterTests {
    private static int checks;
    private static final byte[] BANK = "{\"format\":\"piggy-study-bank\",\"题图\":\"原图\"}".getBytes(StandardCharsets.UTF_8);
    private static void check(boolean ok, String what) {
        checks++; if (!ok) throw new AssertionError(what);
    }
    private static byte[] zip(String[] names, byte[][] bodies, Charset charset, boolean stored) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(output, charset)) {
            for (int i = 0; i < names.length; i++) {
                ZipEntry entry = new ZipEntry(names[i]);
                if (stored) {
                    CRC32 crc = new CRC32(); crc.update(bodies[i]);
                    entry.setMethod(ZipEntry.STORED); entry.setSize(bodies[i].length); entry.setCrc(crc.getValue());
                }
                zip.putNextEntry(entry); zip.write(bodies[i]); zip.closeEntry();
            }
        }
        return output.toByteArray();
    }
    private static Map<String, byte[]> read(byte[] data, String name, StudyBankImporter.Limits limits) throws Exception {
        Map<String, byte[]> files = new LinkedHashMap<>();
        StudyBankImporter.Receiver receiver = (n, b) -> { files.put(n, b); return true; };
        if (limits == null) StudyBankImporter.read(new ByteArrayInputStream(data), name, receiver);
        else StudyBankImporter.read(new ByteArrayInputStream(data), name, receiver, limits);
        return files;
    }
    private static void fails(byte[] data, String name, StudyBankImporter.Limits limits, String what) throws Exception {
        try { read(data, name, limits); throw new AssertionError(what); }
        catch (IOException expected) { checks++; }
    }
    public static void main(String[] args) throws Exception {
        check(Arrays.equals(read(BANK, "单份.json", null).get("单份.json"), BANK), "JSON bytes unchanged");
        check(read(BANK, "folder/单份.json", null).containsKey("单份.json"), "JSON basename");
        StudyBankImporter.Result invalid = StudyBankImporter.read(new ByteArrayInputStream(BANK), "invalid.json", (n,b) -> false);
        check(invalid.accepted == 0 && invalid.skipped == 1, "invalid JSON counted by validator");
        String[] names = {"猪猪题库/数学/第一套.json", "猪猪题库/物理/第二套.JSON", "README.txt", "nested.zip"};
        byte[] archive = zip(names, new byte[][] {BANK, BANK, BANK, BANK}, StandardCharsets.UTF_8, false);
        Map<String, byte[]> parsed = read(archive, "全科.zip", null);
        check(parsed.size() == 2 && parsed.containsKey("第一套.json") && parsed.containsKey("第二套.JSON"), "nested folders and unrelated files");
        check(Arrays.equals(parsed.get("第一套.json"), BANK), "ZIP bytes unchanged");
        check(read(archive, "provider-octet-stream.bin", null).size() == 2, "detect ZIP by content");
        byte[] chinese = zip(new String[] {"物理\\中文题库.json"}, new byte[][] {BANK}, Charset.forName("GB18030"), false);
        check(read(chinese, "中文.zip", null).containsKey("中文题库.json"), "Windows Chinese filenames and backslashes");
        String[] unsafe = {"../escape.json", "/absolute.json", "C:/drive.json", "ok/../escape2.json", "__MACOSX/fake.json", "ok/._fake.json", "ok/real.json"};
        byte[][] bodies = new byte[unsafe.length][]; Arrays.fill(bodies, BANK);
        parsed = read(zip(unsafe, bodies, StandardCharsets.UTF_8, false), "unsafe.zip", null);
        check(parsed.size() == 1 && parsed.containsKey("real.json"), "ignore traversal, absolute and resource-fork entries");
        byte[] empty = zip(new String[0], new byte[0][], StandardCharsets.UTF_8, false);
        check(read(empty, "empty.zip", null).isEmpty(), "empty ZIP");
        fails(BANK, "not-a-zip.zip", null, "bad ZIP rejected");
        fails(BANK, "unsupported.rar", null, "RAR rejected");
        fails(BANK, "unsupported.7z", null, "7Z rejected");
        fails(BANK, "too-large.json", new StudyBankImporter.Limits(8, 4096, 4096, 10), "JSON member size limit");
        fails(archive, "too-large.zip", new StudyBankImporter.Limits(8, 4096, 4096, 10), "ZIP member size limit");
        fails(archive, "too-many.zip", new StudyBankImporter.Limits(4096, 4096, 4096, 1), "entry count limit");
        fails(archive, "expanded.zip", new StudyBankImporter.Limits(4096, 4096, BANK.length, 10), "total expanded size limit includes irrelevant files");
        fails(archive, "source.zip", new StudyBankImporter.Limits(4096, 12, 4096, 10), "source size limit");
        byte[] corrupt = zip(new String[] {"first.json", "last.json"}, new byte[][] {BANK, BANK}, StandardCharsets.UTF_8, true);
        byte[] marker = "piggy-study-bank".getBytes(StandardCharsets.UTF_8);
        int found = -1;
        for (int i = 0; i < corrupt.length - marker.length; i++) {
            boolean same = true;
            for (int k = 0; k < marker.length; k++) if (corrupt[i+k] != marker[k]) { same = false; break; }
            if (same) found = i;
        }
        check(found >= 0, "corruption fixture contains payload");
        corrupt[found] ^= 1;
        fails(corrupt, "corrupt.zip", null, "CRC corruption rejects whole import before commit");
        fails(Arrays.copyOf(archive, 55), "truncated.zip", null, "truncated payload rejected");
        byte[] encrypted = archive.clone(); encrypted[6] |= 1;
        fails(encrypted, "encrypted.zip", null, "encrypted ZIP rejected");
        check(read(archive, "repeat.zip", null).size() == 2, "failed import does not affect subsequent import");
        if (args.length == 2) {
            Path input = Paths.get(args[0]), output = Paths.get(args[1]); Files.createDirectories(output);
            final int[] count = {0};
            StudyBankImporter.Result result;
            try (java.io.InputStream stream = Files.newInputStream(input)) {
                result = StudyBankImporter.read(stream, input.getFileName().toString(), (name, data) -> {
                    Files.write(output.resolve(name), data); count[0]++; return true;
                });
            }
            check(result.accepted == 51 && result.skipped == 0 && count[0] == 51, "actual six-subject package imports all 51 banks");
            System.out.println("Actual ZIP: " + result.accepted + " banks, " + result.skipped + " skipped");
        }
        System.out.println("PASS StudyBankImporter: " + checks + " checks");
    }
}
