from http.server import HTTPServer, BaseHTTPRequestHandler

class RedirectHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/subscribe":
            self.send_response(302)
            self.send_header("Location", "http://127.0.0.1:3000")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")

if __name__ == "__main__":
    server_address = ("0.0.0.0", 8080)
    httpd = HTTPServer(server_address, RedirectHandler)
    print("Redirector on port 8080")
    httpd.serve_forever()
