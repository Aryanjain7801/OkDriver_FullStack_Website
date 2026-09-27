Write-Host "Initializing Git repository and pushing to GitHub..." -ForegroundColor Green
git init
git add .
git commit -m "Initial commit: OkDriver CCTV Monitoring Platform with full documentation"
git branch -M main
git remote remove origin 2>$null
git remote add origin https://github.com/Aryanjain7801/OkDriver_FullStack_Website.git
git push -u origin main
Write-Host "Done!" -ForegroundColor Green
