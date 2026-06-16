# Graph Report - barcode-app (2026-06-16)

## Corpus Check

- 106 files · ~145,789 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 703 nodes · 1268 edges · 56 communities (40 shown, 16 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `ab6d9573`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]

## God Nodes (most connected - your core abstractions)

1. `MainActivity` - 63 edges
2. `jsonError()` - 27 edges
3. `readJsonBody()` - 23 edges
4. `readString()` - 21 edges
5. `Barcode Warehouse - Technical Documentation` - 20 edges
6. `مستندات فنی Barcode Warehouse` - 20 edges
7. `scripts` - 18 edges
8. `ExcelExporter` - 17 edges
9. `String` - 17 edges
10. `String` - 17 edges

## Surprising Connections (you probably didn't know these)

- `PATCH()` --calls--> `mapLocation()` [INFERRED]
  app/api/locations/[id]/route.ts → lib/api-mappers.ts
- `PATCH()` --calls--> `jsonError()` [INFERRED]
  app/api/locations/[id]/route.ts → lib/api-utils.ts
- `PATCH()` --calls--> `parseId()` [INFERRED]
  app/api/locations/[id]/route.ts → lib/api-utils.ts
- `PATCH()` --calls--> `readJsonBody()` [INFERRED]
  app/api/locations/[id]/route.ts → lib/api-utils.ts
- `PATCH()` --calls--> `readString()` [INFERRED]
  app/api/locations/[id]/route.ts → lib/api-utils.ts

## Import Cycles

- None detected.

## Communities (56 total, 16 thin omitted)

### Community 0 - "Community 0"

Cohesion: 0.08
Nodes (24): Activity, String, Bundle, Button, CommitAction, EditText, Exception, FrameLayout (+16 more)

### Community 1 - "Community 1"

Cohesion: 0.06
Nodes (59): cx(), Home(), menuItems, scanModeOptions, ContentPanel(), cx(), getPaginationItems(), Modal() (+51 more)

### Community 2 - "Community 2"

Cohesion: 0.09
Nodes (42): DELETE(), PATCH(), DELETE(), PATCH(), DELETE(), PATCH(), DELETE(), PATCH() (+34 more)

### Community 3 - "Community 3"

Cohesion: 0.04
Nodes (45): dependencies, @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/filesystem, @emotion/react, @emotion/styled, @hookform/resolvers (+37 more)

### Community 4 - "Community 4"

Cohesion: 0.09
Nodes (35): bytesToBase64(), concatBytes(), crc32(), crcTable, createCell(), createSerialExcelBytes(), createZip(), downloadSerialExcelBytes() (+27 more)

### Community 5 - "Community 5"

Cohesion: 0.05
Nodes (37): husky.sh script, devDependencies, autoprefixer, baseline-browser-mapping, dotenv, eslint, eslint-config-next, eslint-config-prettier (+29 more)

### Community 6 - "Community 6"

Cohesion: 0.06
Nodes (31): Android APK connection problems, Android Application, Application Areas, Backup Recommendations, Barcode Warehouse - Technical Documentation, Build APK, Build APK connected to production server, Core Features (+23 more)

### Community 7 - "Community 7"

Cohesion: 0.06
Nodes (31): Migration در Production, Reverse Proxy, ارسال اطلاعات انجام نمی‌شود, استقرار Production, اپلیکیشن اندروید, ایجاد اطلاعات اولیه توسعه, بخش‌های برنامه, بروزرسانی Schema (+23 more)

### Community 8 - "Community 8"

Cohesion: 0.16
Nodes (10): Test, List, String, Context, ExampleInstrumentedTest, ExcelExporter, SaveResult, SaveResult (+2 more)

### Community 9 - "Community 9"

Cohesion: 0.14
Nodes (23): createCookieHeader(), createSessionToken(), fromBase64Url(), getAuthSecret(), getSessionMaxAgeSeconds(), hashPassword(), scrypt, SessionPayload (+15 more)

### Community 10 - "Community 10"

Cohesion: 0.09
Nodes (22): AC Product Buttons, Application Requests Login Again, Barcode Scanning Workflow, Barcode Warehouse - Operator Guide, Best Practices, Clear Current List, Common Problems, Delete One Row (+14 more)

### Community 11 - "Community 11"

Cohesion: 0.09
Nodes (22): Motor, Panel, Unknown Product, ارسال اطلاعات, ارسال ناموفق, ایجاد سند جدید, ثبت دستی اطلاعات, حذف یک ردیف (+14 more)

### Community 12 - "Community 12"

Cohesion: 0.09
Nodes (22): 1. Clone the repository, 2. Install dependencies, 3. Configure environment variables, Android Applications, Barcode Warehouse, Build APKs Connected to a Remote Server, Build Both APKs, Database Setup (+14 more)

### Community 13 - "Community 13"

Cohesion: 0.09
Nodes (21): tsconfig-paths, compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+13 more)

### Community 14 - "Community 14"

Cohesion: 0.24
Nodes (8): JSONObject, List, String, Exception, HttpURLConnection, InputStream, ApiClient, ApiException

### Community 15 - "Community 15"

Cohesion: 0.22
Nodes (17): detectSqlEncoding(), insertPatterns, LegacyProduct, LegacySerial, LegacyUser, main(), nullableSqlString(), parseProduct() (+9 more)

### Community 16 - "Community 16"

Cohesion: 0.22
Nodes (8): Android APKs For Real Server, Barcode App Deployment, First Deploy, nginx Reverse Proxy, Production Environment, Repeat Deploy, Server Requirements, Smoke Tests

### Community 17 - "Community 17"

Cohesion: 0.29
Nodes (6): appId, appName, server, cleartext, url, webDir

### Community 19 - "Community 19"

Cohesion: 0.40
Nodes (3): JSONObject, String, ProductModel

### Community 20 - "Community 20"

Cohesion: 0.33
Nodes (5): Backend, Build, D'CODE Native Scanner, Override API URL, Package

### Community 22 - "Community 22"

Cohesion: 0.25
Nodes (7): css.lint.unknownAtRules, gradle.nestedProjects, java.configuration.runtimes, java.configuration.updateBuildConfiguration, java.import.exclusions, java.import.gradle.java.home, java.import.gradle.wrapper.enabled

## Knowledge Gaps

- **268 isolated node(s):** `PreToolUse`, `husky.sh script`, `java.configuration.runtimes`, `java.import.exclusions`, `java.import.gradle.wrapper.enabled` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 5` to `Community 3`, `Community 13`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `tsconfig-paths` connect `Community 13` to `Community 5`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `jsonError()` (e.g. with `DELETE()` and `PATCH()`) actually correct?**
  _`jsonError()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `readJsonBody()` (e.g. with `PATCH()` and `PATCH()`) actually correct?**
  _`readJsonBody()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `readString()` (e.g. with `PATCH()` and `PATCH()`) actually correct?**
  _`readString()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PreToolUse`, `husky.sh script`, `java.configuration.runtimes` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08146067415730338 - nodes in this community are weakly interconnected._
