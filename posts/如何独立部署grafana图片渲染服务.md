---
date: 2024-07-21 16:44:00
title: 如何独立部署grafana图片渲染服务?
author: codeman
location: 上海
---
## 1. grafana图片渲染是什么？
### 1.1 图片渲染介绍
众所周知grafana有一个[插件](https://github.com/grafana/grafana-image-renderer)用于触发告警的时候给panel截图，
或者用于分享panel的时候截图

同时也支持将这个插件单独部署，作为一个远程服务供grafana调用,

单独部署时，将这个渲染服务的api配置到grafana的配置中，像下面这样即可：
```json
[rendering]
server_url = http://localhost:8081/render    ## 用于告诉grafana需要渲染图片的时候调哪个接口
callback_url = http://localhost:3000/        ## 
```
### 1.2 在独立部署图片渲染服务时，渲染图片的流程是怎么样的？


```mermaid

	sequenceDiagram
    participant grafana
    participant render


        grafana-->>render: render request
        render->>grafana: request render url
        render-->>render: do render
    render-->>grafana: return render result
```
grafana请求render的时候的参数是：

```json
http://localhost:8081/render
        
{
    "deviceScaleFactor": "1.000000",
    "domain": "localhost",
    "encoding": "png",
    "height": "500",
    "renderKey": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJSZW5kZXJVc2VyIjp7Im9yZ19pZCI6MSwidXNlcl9pZCI6Mywib3JnX3JvbGUiOiJBZG1pbiJ9LCJleHAiOjE3MjE1NTM0NDF9.rE2ag__yTe9SaRQlZCWwmnT9Kpb-1lWKafg3DEhaonBypMgUJnYQ-vIjb90JtOwSC8z90GaO3jfJuVy5RaWZlQ",
    "timeout": "60",
    "timezone": "",
    "url": "http://localhost:3000/d-solo/dds8i1mqqa680e/new-dashboard?panelId=1&orgId=1&render=1",
    "width": "1000"
}

Header：
X-Auth-Token：-

```
其中关键的参数是：
```json
url         : 用于告诉渲染服务渲染哪个页面（这个页面就是grafana的一个页面）
renderKey   : render访问grafana页面的时候需要带着的一个token
```
## 2. 为什么要独立部署？

使用grafana的插件或者独立部署render供grafana调用，在结果上区别不大，受限于render对机器性能的要求

即使独立部署了render，受限于渲染时对机器性能的要求，如果如需要同时渲染多张图片，那render也是有瓶颈的



### 2.1 所以为什么还要独立部署？ 

如果可以单独部署一个render，直接调render的渲染接口
```json
http://localhost:8081/render
```
甚至可以通过部署多个render提高整体的渲染性能

### 2.2 这样有什么用？

在日常巡检监控面板的时候，
1. 需要逐个panel截图
2. 对于某些panel需要多次调整时间区间，查看并截图
3. 如果只需要记录某个时间监控情况，过一段时间grafana就不可看了（通常仅保留不到一个月的时间）
4. 基于1 ，巡检的时候没办法逐个panel确认巡检结果

综上，希望可以通过独立调用render，建设一个巡检的平台，实现对监控的记录，以及巡检确认的平台

## 3. 怎么做？
基于上面的介绍，可以知道能通过直接调render的接口，

传递给render 要 渲染的URL和 访问要渲染的URL时传递的renderKey



### 3.1 要访问的URL是怎么样的？或者说怎么获得？

```json
http://localhost:3000/d-solo/dds8i1mqqa680e/new-dashboard?panelId=1&orgId=1&render=1
```
dds8i1mqqa680e   todo

new-dashboard  面板的名称

panelId=1      panel 的id

比较关键的就是上面三个参数，替换成对应的就可以了

### 3.2 renderKey

renderKey 是 grafana生成

传递给 render 

render访问grafana的某个panel的时候传递给grafana

renderKey在grafana内部生成并缓存，且有一定随机性，且有过期时间，且在使用后会被删除，所以理论上无法获得并使用

但还是要介绍一下：参考4.7

### 3.3 renderKey 不是很好的方式是否还有别的方式？

参考4.8  4.9（终极简单方案）

## 4. 探索直接调用render的整个过程

### 4.1. git clone render的代码 
```json
git clone https://github.com/grafana/grafana-image-renderer.git
```
### 4.2. build
```json
yarn install --pure-lockfile
yarn run build
```
### 4.3. 启动
```json
node build/app.js server --port=8081
```
### 4.4. git clone grafana代码
```json
git clone https://github.com/grafana/grafana.git
```
### 4.5. 构建并启动
```json
前端部分

yarn install --immutable

yarn start

后端部分

make run

```
都构建好即可打开 浏览器
```
http://localhost:3000/
```
可以看到grafana 已经启动了
### 4.6. 额外

如果是windows 需要
在WSL中clone 并构建代码

需要注意的是 goland 配置goroot 是wsl中的go
![](./assets/如何独立部署grafana图片渲染服务-1721559641950.png)

**同时安装go 的时候最好使用 下载解压配置环境变量的方式**

### 4.7. renderKey 怎么获取（需要看最终方法跳过这个 直接看4.9）

处理 /render 接口的代码位于

```json
HttpServer.render
```
![](./assets/如何独立部署grafana图片渲染服务-1721558859070.png)

可以看到 是从请求参数中 获取 renderKey

在这里打印一下参数 

![](./assets/如何独立部署grafana图片渲染服务-1721558909967.png)

就可以看到renderKey是什么？

![](./assets/如何独立部署grafana图片渲染服务-1721560775911.png)

然后使用renderKey 直接请求render 
```json
http://localhost:8081/render
```
像上面说的  renderKey 只能用一次

所以这里需要做两件事

1. 在grafana生成renderKey 的地方，将过期时间设置的长一些
```json
pkg/services/rendering/auth.go

func (r *perRequestRenderKeyProvider) get(ctx context.Context, opts AuthOpts) (string, error) {
return generateAndSetRenderKey(r.cache, ctx, opts, 2222222222)
}
```
2. 在grafana中删除renderKey的地方，移除删除的逻辑
```json
pkg/services/rendering/auth.go

func deleteRenderKey(cache *remotecache.RemoteCache, log log.Logger, ctx context.Context, renderKey string) {
	//err := cache.Delete(ctx, fmt.Sprintf(renderKeyPrefix, renderKey))
	//if err != nil {
	//	log.Error("Failed to delete render key", "error", err)
	//}
	return
}
```
这样就可以直接请求 render了

```json

curl --location --request GET '127.0.0.1:8081/render?url=http://localhost:3000/d-solo/dds8i1mqqa680e/new-dashboard?panelId=1%26orgId=1%26render=1&renderKey=mnJBDk0QxfZ2gpLtG6Lrqtowk6yDiaeV&domain=localhost' \
--header 'X-Auth-Token: -' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)'

```

可以直接返回渲染的panel的图片


![](./assets/如何独立部署grafana图片渲染服务-1721561398229.png)

### 4.8. 4.7中描述的方式可以达到目的，但是需要修改grafana的代码 （需要看最终方法跳过这个 直接看4.9）
那么有没有更好的方式？ 有！！！

给grafana配置jwt，就可以了。

分为两步：
1. 修改grafana配置 default.ini ，修改auth.jwt 这部分的所有内容
```json
[auth.jwt]
enabled = true
enable_login_token = true
header_name = X-jwt-ttk
email_claim = sub
username_claim = sub
email_attribute_path =
username_attribute_path =
jwk_set_url = https://dev-a6snru0l7etv5rov.us.auth0.com/.well-known/jwks.json
jwk_set_file =
cache_ttl = 60m
expect_claims = {}
key_file =
key_id =
role_attribute_path = role
role_attribute_strict = false
groups_attribute_path =
auto_sign_up = true
url_login = true
allow_assign_grafana_admin = true
skip_org_role_sync = false
```
其他的直接copy即可，需要注意的是 jwk_set_url 是怎么来的？参考另一篇文章：[auth0如何创建jwt](https://codeman.im/auth0%E5%A6%82%E4%BD%95%E7%94%9F%E6%88%90jwt)
```json
jwk_set_url = https://dev-a6snru0l7etv5rov.us.auth0.com/.well-known/jwks.json
```

同时可以获得token，以auth_token拼接到要访问的URL后即可，同时不需要传renderKey了，类似：
```json
curl --location --request GET 
'127.0.0.1:8081/render?url=http://localhost:3000/d-solo/dds8i1mqqa680e/new-dashboard?panelId=1%26orgId=1%26render=1%26auth_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjlhV1dzbnVGclhWT1hUTnZoZE1pUSJ9.eyJpc3MiOiJodHRwczovL2Rldi1hNnNucnUwbDdldHY1cm92LnVzLmF1dGgwLmNvbS8iLCJzdWIiOiJEMHB4bHZLYzFYblYwVHlEcW5zWm1qZkVzejNvOUlmQkBjbGllbnRzIiwiYXVkIjoiZ3JhZmFuYXRlc3QiLCJpYXQiOjE3MjE1NDQyNjQsImV4cCI6MTcyMTYzMDY2NCwiZ3R5IjoiY2xpZW50LWNyZWRlbnRpYWxzIiwiYXpwIjoiRDBweGx2S2MxWG5WMFR5RHFuc1ptamZFc3ozbzlJZkIifQ.Qk9AEfHANWsZP9PAnvfRcDkDpX3qoIF9tkgMiOMsF9A-JcIzveB5q5CkPCGXhgwfQHdZmjCVp97HYJ3mAmqiWCPoFydkkOTOKThiFYYtXsq-esNTj9VP-bGD3uc4SyIZrNPtr7WEwaganc15UL7nVdaqMGSvNbrUf9HtsW_UYRxIABGwiPOnbnWa1VkkVpmmYZnMQhOaqTR3DScyDPIc_4-pNpHUybeh81eGLiaq1qVoVNQWXQgNpFQLXVa-s-wSLXE7wFxYy-Q6RAb5TjT6cWkare9j8BpxiJiQda1Y02dfq8oDKHGTjFUCjUGLGJgRnXm1tppLii-WL09Ij24SjA%26viewPanel=1&domain=localhost' \
--header 'X-Auth-Token: -' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)'
```

![](./assets/如何独立部署grafana图片渲染服务-1721566099553.png)

### 4.9 终极简单方案

介绍一下原理，在render 调 grafana的时候在header中传递 grafana的 token 给grafana

#### 4.9.1 获取 token

按下面步骤获取到token  


![](./assets/如何独立部署grafana图片渲染服务-1721738917271.png)

![](./assets/如何独立部署grafana图片渲染服务-1721740624096.png)


![](./assets/如何独立部署grafana图片渲染服务-1721738995671.png)

![](./assets/如何独立部署grafana图片渲染服务-1721739016871.png)


![](./assets/如何独立部署grafana图片渲染服务-1721739036979.png)

#### 4.9.2 如何传递token

修改render （grafana-image-render）代码

```json
src/browser/browser.ts
```

```js

page.setExtraHTTPHeaders({
          'Authorization':'Bearer token'
        })
// 在这一行上面添加上面的内容 Bearer 后面的就是前面获取到的token
return page.goto(options.url, { waitUntil: 'networkidle0', timeout: options.timeout * 1000 });

```

重新build

```js
yarn run build

```

然后重新启动 render

```js
node build/app.js server --port=8081
```

再调 render渲染接口，这次不传renderKey 也不传jwt token，也可以获取到截图了
```js
curl --location --request GET '127.0.0.1:8081/render?url=http://localhost:3000/d-solo/dds8i1mqqa680e/new-dashboard?panelId=1%26orgId=1%26render=1%26viewPanel=%26from=1721736889194%26to=1721738490788&domain=localhost' \
--header 'X-Auth-Token: -' \
--header 'User-Agent: Apifox/1.0.0 (https://apifox.com)'
```


![](./assets/如何独立部署grafana图片渲染服务-1721739661564.png)

完结撒花
