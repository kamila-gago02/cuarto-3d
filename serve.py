#!/usr/bin/env python3
"""Servidor estatico minimo para previsualizar el cuarto 3D en local.
Uso: python serve.py [puerto]
Sirve el directorio donde esta este archivo en 127.0.0.1.
"""
import sys
import os
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
ROOT = os.path.dirname(os.path.abspath(__file__))

Handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print(f"Sirviendo {ROOT} en http://127.0.0.1:{PORT}  (Ctrl+C para parar)", flush=True)
httpd.serve_forever()
