package local.piggy.playground;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Grants the system installer read access to one verified private APK, never a directory. */
public final class UpdateProvider extends ContentProvider {
    public static final String AUTHORITY = "local.piggy.playground.updates";
    public static final Uri URI = Uri.parse("content://" + AUTHORITY + "/update.apk");
    static File apk(android.content.Context context) {
        return new File(context.getCacheDir(), "piggy-updates/update.apk");
    }
    private File file(Uri uri) {
        if (!URI.equals(uri)) throw new IllegalArgumentException("Unknown update file");
        return apk(getContext());
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { file(uri); return "application/vnd.android.package-archive"; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Read access only");
        return ParcelFileDescriptor.open(file(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        File apk = file(uri);
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        Object[] row = new Object[columns.length];
        for (int i=0; i<columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = "PiggyPlayground-update.apk";
            else if (OpenableColumns.SIZE.equals(columns[i])) row[i] = apk.length();
        }
        MatrixCursor result = new MatrixCursor(columns, 1);
        result.addRow(row);
        return result;
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String where, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String where, String[] args) { throw new UnsupportedOperationException(); }
}
