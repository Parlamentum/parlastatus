#!/bin/bash

# Update package list
sudo apt update

# Install Node.js and npm
sudo apt install -y nodejs npm

# Install Git
sudo apt install -y git

# Create project directory
mkdir minecraft-monitor
cd minecraft-monitor

# Initialize npm and install dependencies
npm init -y
npm install express axios socket.io ejs body-parser

# Create necessary directories
mkdir public views logs

echo "Installation complete."
