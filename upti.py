from flask import Flask # Make sure to install the flask package
from threading import Thread
import time

app = Flask('')

@app.route('/') # The "main" page of the website. The root.
def home():
  return "Webserver OK"

def run():
  app.run(host="0.0.0.0", port=93070)

def keep_alive():
  t = Thread(target=run)
  t.start()