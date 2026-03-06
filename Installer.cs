using System;
using System.IO;
using System.Net;
using System.Diagnostics;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Text;

public class DeltaInstaller {
    private static string REPO_ZIP = "https://github.com/nnoverr/DeltaMusic/archive/refs/heads/main.zip";
    private static string FOLDER_NAME = "DeltaMusic-main";
    private static string APP_DIR = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DeltaMusic");
    private static string DESKTOP_PATH = Environment.GetFolderPath(Environment.SpecialFolder.Desktop);

    [STAThread]
    public static void Main() {
        Application.EnableVisualStyles();
        
        DialogResult result = MessageBox.Show(
            "Install DeltaMusic Desktop?\n\n- Downloads from GitHub\n- Creates Desktop Shortcut\n- Sets up Local Proxy", 
            "DeltaMusic Installer", 
            MessageBoxButtons.YesNo, 
            MessageBoxIcon.Information
        );

        if (result == DialogResult.Yes) {
            RunInstallation();
        }
    }

    private static void RunInstallation() {
        try {
            if (!Directory.Exists(APP_DIR)) Directory.CreateDirectory(APP_DIR);

            Console.WriteLine("Updating files...");
            string zipPath = Path.Combine(APP_DIR, "repo.zip");

            // Fix SSL/TLS error by enabling TLS 1.2 (3072)
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;

            using (WebClient client = new WebClient()) {
                client.DownloadFile(REPO_ZIP, zipPath);
            }

            // Extract using PowerShell (built-in, no extra deps)
            string psCommand = string.Format(
                "Expand-Archive -Path '{0}' -DestinationPath '{1}' -Force", 
                zipPath, APP_DIR
            );
            RunPowerShell(psCommand);

            // Move PWA contents to root APP_DIR
            string pwaSource = Path.Combine(APP_DIR, FOLDER_NAME, "pwa");
            if (Directory.Exists(pwaSource)) {
                // simple move logic (overwrite)
                CopyDirectory(pwaSource, APP_DIR);
            }

            // Create Shortcut
            CreateShortcut();

            MessageBox.Show("Installation Complete!\n\nDeltaMusic shortcut has been created on your Desktop.", "Success", MessageBoxButtons.OK, MessageBoxIcon.Information);
        } catch (Exception ex) {
            MessageBox.Show("Installation Error: " + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void CreateShortcut() {
        string shortcutPath = Path.Combine(DESKTOP_PATH, "DeltaMusic.lnk");
        string exePath = Path.Combine(APP_DIR, "DeltaMusic.exe");
        string iconPath = Path.Combine(APP_DIR, "app.ico");
        
        // Use PowerShell to create the shortcut (safest way without adding COM references to CSC)
        string psCommand = string.Format(
            "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{0}'); " +
            "$s.TargetPath = '{1}'; " +
            "$s.WorkingDirectory = '{2}'; " +
            "$s.IconLocation = '{3}'; " +
            "$s.Save()", 
            shortcutPath, exePath, APP_DIR, iconPath
        );
        RunPowerShell(psCommand);
    }

    private static void RunPowerShell(string command) {
        ProcessStartInfo psi = new ProcessStartInfo("powershell", "-command \"" + command + "\"");
        psi.WindowStyle = ProcessWindowStyle.Hidden;
        psi.CreateNoWindow = true;
        Process.Start(psi).WaitForExit();
    }

    private static void CopyDirectory(string sourceDir, string destDir) {
        foreach (string file in Directory.GetFiles(sourceDir, "*.*", SearchOption.AllDirectories)) {
            string destFile = Path.Combine(destDir, file.Substring(sourceDir.Length + 1));
            string destPath = Path.GetDirectoryName(destFile);
            if (!Directory.Exists(destPath)) Directory.CreateDirectory(destPath);
            File.Copy(file, destFile, true);
        }
    }
}
