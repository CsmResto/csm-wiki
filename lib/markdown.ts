import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'
import { Locale } from '@/lib/i18n/locales'

export interface MarkdownFile {
  fullPath: string
  slug: string
}

export interface WikiPageMeta {
  slug: string
  title: string
  description?: string
  order?: number
  updatedAt?: string
}

export interface MarkdownData extends WikiPageMeta {
  contentHtml: string
  frontmatter: Record<string, unknown>
}

export interface WikiTreeNode {
  name: string
  slug: string
  directories: WikiTreeNode[]
  pages: WikiPageMeta[]
}

export interface WikiDirectoryData {
  slug: string
  name: string
  directories: Array<{ name: string; slug: string }>
  pages: WikiPageMeta[]
}

const contentDirectory = path.join(process.cwd(), 'content')

function getLocaleContentDirectory(locale: Locale): string {
  return path.join(contentDirectory, locale)
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function toTitleFromSlug(slug: string): string {
  const lastPart = slug.split('/').pop() ?? slug
  return lastPart
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function parseWikiMeta(slug: string, fileContents: string): WikiPageMeta {
  const { data } = matter(fileContents)

  const fmTitle = typeof data.title === 'string' ? data.title : undefined
  const fmDescription = typeof data.description === 'string' ? data.description : undefined
  const fmOrder = typeof data.order === 'number' ? data.order : undefined
  const fmUpdatedAt = typeof data.updatedAt === 'string' ? data.updatedAt : undefined

  const meta: WikiPageMeta = {
    slug,
    title: fmTitle ?? toTitleFromSlug(slug),
  }

  if (fmDescription !== undefined) {
    meta.description = fmDescription
  }
  if (fmOrder !== undefined) {
    meta.order = fmOrder
  }
  if (fmUpdatedAt !== undefined) {
    meta.updatedAt = fmUpdatedAt
  }

  return meta
}

function toSerializableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializableValue(item))
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      toSerializableValue(item),
    ])
    return Object.fromEntries(entries)
  }

  return value
}

function toSafeLanguageId(rawLanguage: string): string {
  const normalized = rawLanguage.trim().toLowerCase()
  if (!normalized) {
    return 'text'
  }

  return normalized.replace(/[^a-z0-9#+-]/g, '')
}

function toLanguageLabel(language: string): string {
  if (!language || language === 'text') {
    return 'Text'
  }

  if (language === 'ts') {
    return 'TypeScript'
  }
  if (language === 'js') {
    return 'JavaScript'
  }
  if (language === 'sh') {
    return 'Shell'
  }

  return language.toUpperCase()
}

function slugifyHeading(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\s]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'section'
}

type MarkdownNode = {
  type?: string
  value?: unknown
  url?: string
  children?: MarkdownNode[]
  data?: {
    hProperties?: Record<string, unknown>
  }
}

function getHeadingText(node: MarkdownNode | null | undefined): string {
  if (!node) {
    return ''
  }

  if (node.type === 'text' || node.type === 'inlineCode') {
    return String(node.value ?? '')
  }

  if (Array.isArray(node.children)) {
    return node.children.map((child: MarkdownNode) => getHeadingText(child)).join('')
  }

  return ''
}

function extractCustomHeadingId(node: MarkdownNode): string | null {
  if (!Array.isArray(node.children) || node.children.length === 0) {
    return null
  }

  const lastIndex = node.children.length - 1
  const lastChild = node.children[lastIndex]

  if (lastChild?.type !== 'text' || typeof lastChild.value !== 'string') {
    return null
  }

  const text = lastChild.value
  const match = text.match(/\s*\{#([A-Za-z0-9_-]+)\}\s*$/)
  if (!match) {
    return null
  }

  const id = match[1]
  const trimmed = text.replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, '').trimEnd()

  if (trimmed) {
    lastChild.value = trimmed
  } else {
    node.children.splice(lastIndex, 1)
  }

  return id
}

function remarkAutolinkHeadings() {
  return (tree: MarkdownNode) => {
    const slugCounts = new Map<string, number>()

    const visit = (node: MarkdownNode | null | undefined) => {
      if (!node || typeof node !== 'object') {
        return
      }

      if (node.type === 'heading') {
        const customId = extractCustomHeadingId(node)
        const text = getHeadingText(node)
        const baseSlug = customId ?? slugifyHeading(text)
        const currentCount = slugCounts.get(baseSlug) ?? 0
        const nextCount = currentCount + 1
        slugCounts.set(baseSlug, nextCount)
        const slug = nextCount === 1 ? baseSlug : `${baseSlug}-${nextCount}`

        node.data ||= {}
        node.data.hProperties ||= {}
        node.data.hProperties.id = slug

        node.children = [
          {
            type: 'link',
            url: `#${slug}`,
            data: {
              hProperties: {
                className: ['heading-anchor'],
              },
            },
            children: node.children ?? [],
          },
        ]
      }

      if (Array.isArray(node.children)) {
        node.children.forEach((child: MarkdownNode) => visit(child))
      }
    }

    visit(tree)
  }
}

function enhanceMarkdownHtml(contentHtml: string): string {
  const withTaskItems = contentHtml.replace(/<li>\s*\[( |x|X)\]\s+([\s\S]*?)<\/li>/g, (_match, marker, itemHtml) => {
    const isChecked = marker.toLowerCase() === 'x'
    const checkedAttribute = isChecked ? ' checked' : ''
    return `<li class="task-list-item"><label><input type="checkbox" disabled${checkedAttribute} /><span>${itemHtml}</span></label></li>`
  })

  const withTaskLists = withTaskItems.replace(/<ul>([\s\S]*?)<\/ul>/g, (listHtml, listInnerHtml) => {
    if (!listInnerHtml.includes('class="task-list-item"')) {
      return listHtml
    }
    return `<ul class="task-list">${listInnerHtml}</ul>`
  })

  const withTypedCodeBlocks = withTaskLists.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_match, language, codeHtml) => {
      const safeLanguage = toSafeLanguageId(language)
      const languageLabel = toLanguageLabel(safeLanguage)
      return `<figure class="code-block" data-language="${safeLanguage}"><figcaption class="code-block__header"><span class="code-block__lang">${languageLabel}</span><button type="button" class="code-block__copy" data-copy-code>Copy</button></figcaption><pre><code class="language-${safeLanguage}">${codeHtml}</code></pre></figure>`
    }
  )

  return withTypedCodeBlocks.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (_match, codeHtml) => {
    return `<figure class="code-block" data-language="text"><figcaption class="code-block__header"><span class="code-block__lang">Text</span><button type="button" class="code-block__copy" data-copy-code>Copy</button></figcaption><pre><code>${codeHtml}</code></pre></figure>`
  })
}

function sortPages(pages: WikiPageMeta[], locale: Locale): WikiPageMeta[] {
  return pages.sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    return left.title.localeCompare(right.title, locale)
  })
}

function ensureDirectoryNode(root: WikiTreeNode, directoryMap: Map<string, WikiTreeNode>, directorySlug: string): WikiTreeNode {
  if (directoryMap.has(directorySlug)) {
    return directoryMap.get(directorySlug) as WikiTreeNode
  }

  const segments = directorySlug.split('/').filter(Boolean)
  let parentSlug = ''
  let parentNode = root

  for (const segment of segments) {
    const currentSlug = parentSlug ? `${parentSlug}/${segment}` : segment
    const existingNode = directoryMap.get(currentSlug)

    if (existingNode) {
      parentNode = existingNode
      parentSlug = currentSlug
      continue
    }

    const nextNode: WikiTreeNode = {
      name: segment,
      slug: currentSlug,
      directories: [],
      pages: [],
    }

    parentNode.directories.push(nextNode)
    directoryMap.set(currentSlug, nextNode)
    parentNode = nextNode
    parentSlug = currentSlug
  }

  return parentNode
}

function sortWikiTree(node: WikiTreeNode, locale: Locale): WikiTreeNode {
  node.directories.sort((left, right) => left.name.localeCompare(right.name, locale))
  sortPages(node.pages, locale)
  node.directories.forEach((child) => sortWikiTree(child, locale))
  return node
}

function findWikiTreeNodeBySlug(node: WikiTreeNode, slug: string): WikiTreeNode | null {
  if (node.slug === slug) {
    return node
  }

  for (const child of node.directories) {
    const found = findWikiTreeNodeBySlug(child, slug)
    if (found) {
      return found
    }
  }

  return null
}

export function getAllMarkdownFiles(
  locale: Locale,
  dirPath: string = getLocaleContentDirectory(locale),
  basePath: string = ''
): MarkdownFile[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files: MarkdownFile[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(locale, fullPath, relativePath))
    } else if (entry.name.endsWith('.md')) {
      const slug = toPosixPath(relativePath).replace(/\.md$/, '')
      files.push({ fullPath, slug })
    }
  }

  return files
}

export function getAllDirectorySlugs(
  locale: Locale,
  dirPath: string = getLocaleContentDirectory(locale),
  basePath: string = ''
): string[] {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const directories: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const relativePath = toPosixPath(path.join(basePath, entry.name))
    directories.push(relativePath)
    directories.push(...getAllDirectorySlugs(locale, path.join(dirPath, entry.name), relativePath))
  }

  return directories
}

export function getAllWikiPages(locale: Locale): WikiPageMeta[] {
  return sortPages(
    getAllMarkdownFiles(locale).map(({ fullPath, slug }) => {
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      return parseWikiMeta(slug, fileContents)
    }),
    locale
  )
}

export function getAllWikiRouteSlugs(locale: Locale): string[] {
  const fileSlugs = getAllMarkdownFiles(locale).map((item) => item.slug)
  const directorySlugs = getAllDirectorySlugs(locale)

  const fileSet = new Set(fileSlugs)
  for (const directorySlug of directorySlugs) {
    if (fileSet.has(directorySlug)) {
      throw new Error(
        `Route conflict at "${directorySlug}". Use "${directorySlug}/index.md" for folder landing pages instead of "${directorySlug}.md".`
      )
    }
  }

  return [...new Set([...directorySlugs, ...fileSlugs])]
}

export function getWikiTree(locale: Locale): WikiTreeNode {
  const root: WikiTreeNode = {
    name: 'content',
    slug: '',
    directories: [],
    pages: [],
  }

  const directoryMap = new Map<string, WikiTreeNode>([['', root]])

  for (const directorySlug of getAllDirectorySlugs(locale)) {
    ensureDirectoryNode(root, directoryMap, directorySlug)
  }

  for (const page of getAllWikiPages(locale)) {
    const segments = page.slug.split('/')
    segments.pop()
    const parentSlug = segments.join('/')
    ensureDirectoryNode(root, directoryMap, parentSlug).pages.push(page)
  }

  return sortWikiTree(root, locale)
}

export function getWikiDirectoryData(locale: Locale, slug: string): WikiDirectoryData | null {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const tree = getWikiTree(locale)
  const node = findWikiTreeNodeBySlug(tree, normalizedSlug)

  if (!node) {
    return null
  }

  return {
    slug: normalizedSlug,
    name: normalizedSlug ? (normalizedSlug.split('/').pop() as string) : 'content',
    directories: node.directories.map((directory) => ({
      name: directory.name,
      slug: directory.slug,
    })),
    pages: node.pages,
  }
}

export function isDirectorySlug(locale: Locale, slug: string): boolean {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  if (!normalizedSlug) {
    return true
  }

  const directoryPath = path.join(getLocaleContentDirectory(locale), normalizedSlug)
  return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory()
}

export async function getMarkdownData(locale: Locale, slug: string): Promise<MarkdownData> {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const fullPath = path.join(getLocaleContentDirectory(locale), `${normalizedSlug}.md`)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Markdown page not found for slug: ${slug}`)
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  const processedContent = await remark()
    .use(remarkAutolinkHeadings)
    .use(html)
    .process(content)

  return {
    ...parseWikiMeta(normalizedSlug, fileContents),
    contentHtml: enhanceMarkdownHtml(processedContent.toString()),
    frontmatter: toSerializableValue(data) as Record<string, unknown>,
  }
}
