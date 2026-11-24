import sys
import os

# Ensure root directory is on Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import app

# Vercel serverless handler
