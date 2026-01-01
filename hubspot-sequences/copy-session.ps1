$source = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$dest = "$env:LOCALAPPDATA\Playwright-HubSpot-Automation"

# Create destination directories
New-Item -ItemType Directory -Path "$dest\Default\Network" -Force | Out-Null

# Copy essential session files
Copy-Item "$source\Default\Network\Cookies" "$dest\Default\Network\" -Force
Copy-Item "$source\Default\Preferences" "$dest\Default\" -Force -ErrorAction SilentlyContinue
Copy-Item "$source\Local State" "$dest\" -Force -ErrorAction SilentlyContinue

Write-Host "Session data copied successfully!"
