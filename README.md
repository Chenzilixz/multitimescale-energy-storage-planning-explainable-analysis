# 多时间尺度储能协同规划可解释分析平台

用于 GitHub → Vercel 部署的独立网页版本。包含14项规划输入、10项规划输出，以及经济性、低碳性双维度Tree SHAP分析。每位访问者在自己的浏览器中导入、拟合、解释与保存数据，无需安装Python。

## 按教程部署

1. 在自己的GitHub账户创建空的 **Private（私有）** 仓库，建议名称 storage-shap-platform；不勾选自动添加README。
2. 将本目录完整代码推送至该仓库的 main 分支。不要上传上一级项目目录。
3. 在Vercel登录，选择 Add New → Project → Import，对应刚建立的仓库。
4. Framework Preset 选择 **Other**；Root Directory 保持仓库根目录；Build Command 为 `node scripts/verify-static.cjs`；Output Directory 为 `dist`；Install Command 留空。vercel.json已声明这些设置。
5. 不需要环境变量、API Key或付费AI接口。检查当前账户和套餐后点击Deploy。
6. 部署完成后使用实际生成的生产网址测试。若存在部署访问保护，应按需要核对生产域名的访问范围，不能只验证自己登录后能访问。

## 验证

运行 `node scripts/verify-static.cjs` 可检查程序语法、静态资源和发布目录。部署后在新的浏览器工作区打开网址，核对2400组合成示例、14/14输入、10/10输出，运行双维度分析，再测试自有Excel/CSV导入、方案对比、图表切换和报告导出。

## 数据与算法

内置2400组数据为独立公式生成的合成演示，供功能验证，不是实际规划模型求解结果。本仓库不包含项目合同、原始Excel、私人文件、之前的模型或分析记录。每次分析支持40—10000条有效记录，文件不超过32MB。

训练与Tree SHAP在Web Worker中运行，采用浏览器CART/GBDT、随机森林或极端随机树。未知特征采用树节点样本覆盖概率，重复特征约束在叶路径上合并，再精确计算Shapley贡献；每次运行核对基准值加贡献和等于预测值。计算引擎已与Python TreeExplainer及独立联盟枚举比较。浏览器模型与原Python版属于不同训练实现，不承诺训练结果逐位相同。SHAP解释模型预测的关联贡献，不代表因果效应。

数据和结果保存在当前浏览器，网站没有接收文件或读取他人分析结果的服务器接口。换设备、换域名或清除网站数据后，需重新导入；建议下载分析包留存。

## 域名与访问

Vercel默认提供vercel.app网址，不会自动赠送.com域名。.com需要注册持有后再在Settings → Domains中绑定DNS。Vercel部署本身不能保证所有中国内地网络均可免VPN访问；上线后必须在目标网络中验证，必要时再迁移国内托管。

## 第三方组件

Plotly、JSZip和SHAP图形组件的许可证随dist/static/vendor提供。所有应用必需资源均随网页提供，运行分析不需要外部AI服务。

官方文档：
- https://vercel.com/docs/git/vercel-for-github
- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/domains/working-with-domains/add-a-domain
