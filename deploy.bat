@echo off
echo 高铁票价查询系统 - 快速部署脚本
echo ================================

echo.
echo 1. 构建项目...
call npm run build

echo.
echo 2. 检查构建文件...
if exist "dist\index.html" (
    echo ✅ 构建成功！
) else (
    echo ❌ 构建失败，请检查错误信息
    pause
    exit /b 1
)

echo.
echo 3. 准备部署文件...
xcopy "dist\*" "deploy\" /E /I /Y

echo.
echo 4. 部署文件已准备完成！
echo.
echo 📁 部署文件夹: deploy\
echo 📄 包含文件:
dir deploy\ /B

echo.
echo 🌐 下一步操作:
echo 1. 访问 https://vercel.com
echo 2. 注册/登录账号
echo 3. 点击 "New Project"
echo 4. 上传 deploy 文件夹中的所有文件
echo 5. 点击 "Deploy"
echo.
echo 📱 获得网址后，使用在线工具生成二维码
echo 推荐: https://www.qr-code-generator.com
echo.
pause
