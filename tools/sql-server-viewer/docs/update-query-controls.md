# 2026-10-19 Viewer 查询与分页更新

本地已实现并验证，ECS 尚未更新。此包针对现有 Windows ECS 安装，不是独立安装包。

## 功能与边界

- 筛选可连续添加、单独移除或全部清除；条件为 AND（全部满足）。支持包含、等于、开头是、大小比较、为空。
- 排序面板可添加多个字段、选择升降序、上移优先级和移除。点击应用后按列表顺序执行。点击单个列头则改为该列单独排序。
- 每页 50、100、200、500 行。页码框按 Enter 或点击跳转；非法页码不能提交，服务器处理过期页码时返回最后有效页。
- 保留真实英文名称、备注、列隐藏、列宽拖动、搜索与只读限制。SQL Server/MySQL 均生成参数化筛选及白名单字段排序。
- 没有新增依赖。改用基础只读表格显示当前页，避免社区 DataGrid 的 100 行限制。最多渲染当前页 500 行。

## ECS 操作

将 `sqlviewer-query-controls-20261019.zip` 传到 ECS 的 `C:\Services`。以下操作会短暂中断 Viewer，不需要修改 Caddy。

在 ECS 的管理员 PowerShell 执行（只执行代码块，不要粘贴提示符）：

```powershell
$ErrorActionPreference = 'Stop'
$root = 'C:\Services\sql-server-viewer'
$stage = 'C:\Services\sqlviewer-update-20261019'
$backup = Join-Path 'C:\Services' ('sqlviewer-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path $stage) { throw '解压目录已存在，请使用新的空目录，避免混入旧文件。' }
Expand-Archive -LiteralPath 'C:\Services\sqlviewer-query-controls-20261019.zip' -DestinationPath $stage
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath "$root\src" -Destination $backup -Recurse
Copy-Item -LiteralPath "$root\dist" -Destination $backup -Recurse
Copy-Item -LiteralPath "$root\.env" -Destination $backup
Write-Host "备份目录（包含私密配置，请仅留在服务器）：$backup"
```

在服务器本地用记事本打开 `.env`，确认 `SQLSV_MAX_PAGE_SIZE=500`。不要上传或分享该文件。更新包不包含 `.env`。

```powershell
notepad 'C:\Services\sql-server-viewer\.env'
```

保存后执行（沿用上一步 PowerShell 窗口的变量）：

```powershell
Stop-ScheduledTask -TaskName 'SQL Server Viewer'
Start-Sleep -Seconds 3
Copy-Item "$stage\src\*" "$root\src" -Recurse -Force
Copy-Item "$stage\dist\client\*" "$root\dist\client" -Recurse -Force
Start-ScheduledTask -TaskName 'SQL Server Viewer'
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Seconds 3
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:3001/api/health' -TimeoutSec 3
        if ($health.ok) { $ready = $true; Write-Host 'Viewer 已启动'; break }
    } catch { }
}
if (-not $ready) { Write-Warning '服务未就绪，请查看 logs\server.log 最新日志。' }
```

包中前端已按 `/sqlviewer/` 构建，服务器无需重新安装依赖或构建。刷新原网址（必要时 Ctrl+F5）。选一个超过 500 行的表，检查每页 500、翻页跳转、两个筛选条件和两个排序条件；再检查列隐藏/列宽调整。分别验证可连通的 SQL Server 和 MySQL。ECS 无法访问办公室私网 MySQL 的网络限制仍然存在。

## 回滚

停止该计划任务，将上述备份目录中的 `src`、`dist` 复制回工具目录并覆盖对应文件；如修改了 `.env` 则从服务器私有备份恢复；再启动同一计划任务。新增加但未被旧代码引用的文件可以保留。备份路径以控制台输出为准，不要覆盖其他网站目录。

## 验证记录

- 类型检查、查询选项回归测试通过。
- 浏览器在演示数据上验证 200/500 行、末页跳转、两字段排序优先级、AND 筛选、列宽调整、无效跳页禁用。
- 桌面 1440px、手机 390px 截图检查通过；没有页面脚本错误。
- `/sqlviewer/` 生产构建通过。
- 未连接生产数据库进行真实 SQL 执行验证，未远程更新 ECS，未推送 GitHub。
