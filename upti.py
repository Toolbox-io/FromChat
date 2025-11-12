from flask import Flask # Make sure to install the flask package
from threading import Thread
import time
import random
min_port=49152
max_port=65535

app = Flask('')

@app.route('/') # The "main" page of the website. The root.
def home():
  return "Webserver OK"

def run():
  app.run(host="0.0.0.0", port=random.randint(min_port, max_port))

def keep_alive():
  t = Thread(target=run)
  t.start()