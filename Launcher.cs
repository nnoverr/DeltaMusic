using System;
using System.Diagnostics;
using System.Windows.Forms;
using System.Drawing;
using System.IO;
using System.ComponentModel;

public class DeltaMusicApp : Form {
    private Process serverProcess;
    private NotifyIcon trayIcon;

    [STAThread]
    public static void Main() {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new DeltaMusicApp());
    }

    public DeltaMusicApp() {
        this.WindowState = FormWindowState.Minimized;
        this.ShowInTaskbar = false;
        this.Visible = false;

        trayIcon = new NotifyIcon();
        trayIcon.Text = "DeltaMusic Server";
        
        // Load icon from file if available, else default
        string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app.ico");
        if (File.Exists(iconPath)) {
            try {
                trayIcon.Icon = new Icon(iconPath);
                this.Icon = trayIcon.Icon;
            } catch {
                trayIcon.Icon = SystemIcons.Application;
            }
        } else {
            trayIcon.Icon = SystemIcons.Application;
        }
        
        trayIcon.Visible = true;

        ContextMenu contextMenu = new ContextMenu();
        contextMenu.MenuItems.Add("Open DeltaMusic", (s, e) => OpenBrowser());
        contextMenu.MenuItems.Add("Exit", (s, e) => Application.Exit());
        trayIcon.ContextMenu = contextMenu;

        StartServer();
        OpenBrowser();
    }

    private void StartServer() {
        try {
            string serverPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server.py");
            if (!File.Exists(serverPath)) {
                MessageBox.Show("Error: 'server.py' not found in " + AppDomain.CurrentDomain.BaseDirectory);
                return;
            }

            serverProcess = new Process();
            serverProcess.StartInfo.FileName = "python.exe";
            serverProcess.StartInfo.Arguments = "server.py";
            serverProcess.StartInfo.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
            serverProcess.StartInfo.CreateNoWindow = true;
            serverProcess.StartInfo.UseShellExecute = false;
            serverProcess.Start();
        } catch (Exception ex) {
            MessageBox.Show("Failed to start server: " + ex.Message + "\n\nEnsure Python is installed and in your PATH.");
        }
    }

    private void OpenBrowser() {
        Process.Start("http://localhost:8080");
    }

    protected override void OnClosing(CancelEventArgs e) {
        if (serverProcess != null && !serverProcess.HasExited) {
            try { serverProcess.Kill(); } catch {}
        }
        trayIcon.Visible = false;
        base.OnClosing(e);
    }
}
