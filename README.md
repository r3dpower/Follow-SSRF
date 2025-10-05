# Follow-SSRF
This is a lab for demonstrating a common bypass to SSRF mitigations using HTTP redirects.
⚠️ Warning: This repository intentionally contains insecure code and is provided only for educational, research, and defensive testing in isolated lab environments. Do not deploy this on production systems or any systems you do not own or have explicit permission to test.


## ⚙️Requirements
Only run this lab in an isolated, controlled environment (VM, container, or isolated network). Do not run on production or public-facing hosts.
- Linux system (Debian/Ubuntu/Kali recommended for examples)
- Docker
- Python3

## 🧩 Learning Objectives

- Understand common SSRF mitigations
- Getting familiar with HTTP redirects as a useful bypass

## 🚀 Setup Instructions

1. Clone this repository:

   ```bash
   git clone https://github.com/r3dpower/Follow-SSRF.git
   cd LocalFunInclusion

2. Build and run the Docker image:

   ```bash
   sudo docker build -t ssrf-lab .
   sudo docker run --rm -p 3000:3000 --name ssrf-lab ssrf-lab

3. Run redirect_server.py:
   ```bash
   python3 redirect_server.py

4. In the browser go to http://127.0.0.1:3000 and start the lab!

Happy hacking! 🐱‍💻
