---
"jscodeshift": patch
---

Fix `renameTo` renaming identifiers that are member or label names rather than references to the variable

TypeScript interface and type literal members, enum members, the right side of qualified type names, abstract and accessor class members, private names, Flow object type members, `import.meta` / `new.target`, and statement labels are no longer renamed along with a variable of the same name.
