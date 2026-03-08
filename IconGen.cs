using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;

public class IconGen {
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool DestroyIcon(IntPtr hIcon);

    public static void Main() {
        try {
            using (Bitmap bitmap = (Bitmap)Image.FromFile("icon-512.png")) {
                IntPtr hIcon = bitmap.GetHicon();
                try {
                    using (Icon icon = Icon.FromHandle(hIcon)) {
                        using (FileStream fs = new FileStream("app.ico", FileMode.Create)) {
                            icon.Save(fs);
                        }
                    }
                } finally {
                    DestroyIcon(hIcon);
                }
            }
            Console.WriteLine("app.ico created and handle released");
        } catch (Exception e) {
            Console.WriteLine("Error: " + e.Message);
        }
    }
}
