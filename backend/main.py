from constants import *
from db import *
from models import *
from validation import *
from utils import *
from dependencies import *
from migration import run_migrations
from app import *

# Run database migrations on startup
print("Starting database migration check...")
run_migrations()