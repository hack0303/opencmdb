增加
# 规范资产
如各自规范，数据库规范，日志规范，等等
# 凭证资产
vault_ref: "vault://secret/pay/wechat" # 敏感数据进 Vault，CMDB 只留弱引用
证书与机密凭证资产 (Security & Credential Assets)
这是系统运转的“钥匙”。由于你推崇安全和本地优先（Local-First），AI 在执行运维或业务对接时，必须合法且安全地借用这些凭证。

域名的 TLS/SSL 证书： 如 xxx.com 的证书资产。

AI 消费价值： 证书有过期时间。CMDB 登记该资产后，AI 代理会定期巡检，在证书过期前前置调用 capabilities 触发 Let's Encrypt 自动续签并重载 APISIX。

第三方 API Keys / 令牌通道： 如云厂商 API 密钥、微信支付商户证书。

AI 消费价值： 明确哪个服务拥有哪个 Key 的最高消费权限，防范 AI 越权（Privilege Escalation）。
