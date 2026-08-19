# Simple PowerShell HTTP server for test
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Net;
using System.IO;
using System.Text;
public class PSWebServer {
    public static void Start(string rootDir, int port) {
        HttpListener listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:" + port + "/");
        listener.Start();
        Console.WriteLine("Listening on port " + port);
        while (true) {
          try {
            HttpListenerContext ctx = listener.GetContext();
            HttpListenerRequest req = ctx.Request;
            HttpListenerResponse resp = ctx.Response;
            string relPath = req.Url.AbsolutePath;
            if (relPath == "/") relPath = "/app.html";
            relPath = Uri.UnescapeDataString(relPath);
            string filePath = Path.Combine(rootDir, relPath.TrimStart('/'));
            if (File.Exists(filePath)) {
                byte[] data = File.ReadAllBytes(filePath);
                string ext = Path.GetExtension(filePath).ToLower();
                string ct = "application/octet-stream";
                switch (ext) {
                    case ".html": ct = "text/html;charset=utf-8"; break;
                    case ".js": ct = "application/javascript"; break;
                    case ".css": ct = "text/css"; break;
                    case ".json": ct = "application/json"; break;
                    case ".png": ct = "image/png"; break;
                    case ".jpg": case ".jpeg": ct = "image/jpeg"; break;
                    case ".mp3": ct = "audio/mpeg"; break;
                    case ".aac": ct = "audio/aac"; break;
                    case ".m4a": ct = "audio/mp4"; break;
                    case ".wav": ct = "audio/wav"; break;
                    case ".ttf": ct = "font/ttf"; break;
                    case ".ico": ct = "image/x-icon"; break;
                }
                resp.ContentType = ct;
                resp.ContentLength64 = data.LongLength;
                resp.AppendHeader("Access-Control-Allow-Origin", "*");
                resp.OutputStream.Write(data, 0, data.Length);
            } else {
                byte[] buf = Encoding.UTF8.GetBytes("Not found: " + filePath);
                resp.StatusCode = 404;
                resp.ContentType = "text/plain;charset=utf-8";
                resp.ContentLength64 = buf.LongLength;
                resp.OutputStream.Write(buf, 0, buf.Length);
            }
            resp.OutputStream.Close();
          } catch (Exception ex) {
            Console.WriteLine("Request error: " + ex.Message);
          }
        }
    }
}
"@
[PSWebServer]::Start("C:\Users\18948\Documents\GitHub\Reciting-us\Memorization UI", 8765)
