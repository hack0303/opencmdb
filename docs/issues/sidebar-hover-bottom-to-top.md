---
title: "Sidebar collapsible item hover失灵 — 从下方移入时不触发 hover 背景"
summary: "Assets/Forms 等有子菜单的 sidebar 父节点，从下方相邻菜单移入时 hover:bg-sidebar-accent 不生效，但从上方移入正常"
labels: ["bug", "ui", "sidebar"]
---

## 问题描述

Sidebar 中带有子菜单的 collapsible 父节点（如 Assets、Forms、Account），当鼠标从**下方**相邻菜单项移入时，`hover:bg-sidebar-accent` 背景色不生效。但从**上方**移入时正常。

## 复现步骤

1. 打开 sidebar（任意页面）
2. Assets 和 Forms 都在同一 group（Overview）中，Assets 在上，Forms 在下
3. 鼠标从 **Forms 区域向上**移入 Assets → Assets 不变色（hover 背景不触发）
4. 鼠标从 **Dashboard 区域向下**移入 Assets → Assets 正常变色

## 影响范围

所有 `CollapsibleTrigger asChild` 包裹的 `SidebarMenuButton`：
- Assets
- Forms
- Account
- Pro

Leaf 节点（无子菜单的 Link 项）无此问题。

## 调试发现

### 事件层面

`onMouseEnter` / `onMouseLeave` 在两个方向都**正常触发**：

```
[Sidebar] mouseenter Assets   ← 从上方移入
[Sidebar] mouseleave Assets
[Sidebar] mouseenter Assets   ← 从下方移入（事件正常）
[Sidebar] mouseleave Assets
```

### DOM 层面

Assets 按钮的 bounding box 正常（`width: 32, height: 32`），没有被其他元素遮挡。

### CSS 层面

- `hover:bg-sidebar-accent` 在 CVA class 中存在
- 用 `onMouseEnter` 直接操作 `e.currentTarget.style.backgroundColor = 'red'` **也不生效**
- 说明问题不在 CSS 优先级，可能在 Radix Slot / TooltipTrigger 的 `asChild` 链中

### React 层面

- 用 `useState` + inline style 控制背景色 → 不生效（React 19 concurrent 可能 batch 掉了快速 hover 切换）
- 用 `useRef` 直接操作 DOM → 也不生效

## 可能原因

1. **Radix Slot 多层嵌套**：`CollapsibleTrigger asChild` → `SidebarMenuButton` → `Tooltip > TooltipTrigger asChild > button`，三层 `asChild` 嵌套可能导致事件/样式传递异常
2. **React 19 concurrent rendering**：快速 mouseenter → mouseleave 切换时，中间状态被 batch 合并跳过
3. **shadcn sidebar 的 peer/data 选择器干扰**：`peer/menu-button`、`data-[state=open]` 等选择器可能影响 hover 的视觉呈现

## 受影响代码

`src/components/layout/app-sidebar.tsx` — collapsible 分支：

```tsx
<CollapsibleTrigger asChild>
  <SidebarMenuButton tooltip={item.title} isActive={pathname === item.url}>
    {item.icon && <Icon />}
    <span>{item.title}</span>
    <Icons.chevronRight ... />
  </SidebarMenuButton>
</CollapsibleTrigger>
```

## 尝试过的方案（均无效）

| 方案 | 结果 |
|------|------|
| 显式 `className='hover:bg-sidebar-accent'` | ❌ |
| `className='cursor-pointer'` | ❌ |
| `style={{ backgroundColor: isHovered ? 'var(--sidebar-accent)' : undefined }}` + useState | ❌ |
| `e.currentTarget.style.backgroundColor = 'red'` 直接操作 DOM | ❌ |
| `style={{ cursor: 'pointer' }}` 内联 | ❌ |

## 环境

- Next.js 16
- React 19
- @radix-ui/react-collapsible (latest)
- @radix-ui/react-tooltip (latest)
- shadcn sidebar
- Tailwind CSS v4
