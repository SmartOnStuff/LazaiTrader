#!/bin/bash

# Navigate to the script's directory
cd "$(dirname "$0")" || exit

# Activate virtual environment
source venv/bin/activate

# Log timestamp
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> cron.log

# Run main.py and append output to log
python main.py >> cron.log 2>&1


# Log end timestamp
echo "=== Script finished at $(date '+%Y-%m-%d %H:%M:%S') ===" >> cron.log
echo "--------------------------------------------------------" >> cron.log
