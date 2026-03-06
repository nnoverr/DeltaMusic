using System;
using System.Drawing;
using System.IO;

public class IconGen {
    public static void Main() {
        try {
            using (Bitmap bitmap = (Bitmap)Image.FromFile("icon-512.png")) {
                IntPtr hIcon = bitmap.GetHicon();
                using (Icon icon = Icon.FromHandle(hIcon)) {
                    using (FileStream fs = new FileStream("app.ico", FileMode.Create)) {
                        icon.Save(fs);
                    }
                }
            }
            Console.WriteLine("app.ico created");
        } catch (Exception e) {
            Console.WriteLine("Error: " + e.Message);
        }
    }
}
