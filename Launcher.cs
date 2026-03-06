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
        trayIcon.Icon = this.Icon; // Use form icon
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
            serverProcess = new Process();
            serverProcess.StartInfo.FileName = "python.exe";
            serverProcess.StartInfo.Arguments = "server.py";
            serverProcess.StartInfo.WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory;
            serverProcess.StartInfo.CreateNoWindow = true;
            serverProcess.StartInfo.UseShellExecute = false;
            serverProcess.Start();
        } catch (Exception ex) {
            MessageBox.Show("Failed to start server: " + ex.Message);
        }
    }

    private void OpenBrowser() {
        Process.Start("http://localhost:8080");
    }

    protected override void OnClosing(CancelEventArgs e) {
        if (serverProcess != null && !serverProcess.HasExited) {
            serverProcess.Kill();
        }
        trayIcon.Visible = false;
        base.OnClosing(e);
    }
}
