import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

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

function sortPages(pages: WikiPageMeta[]): WikiPageMeta[] {
  return pages.sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }
    return left.title.localeCompare(right.title, 'ru')
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

function sortWikiTree(node: WikiTreeNode): WikiTreeNode {
  node.directories.sort((left, right) => left.name.localeCompare(right.name, 'ru'))
  sortPages(node.pages)
  node.directories.forEach((child) => sortWikiTree(child))
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

export function getAllMarkdownFiles(dirPath: string = contentDirectory, basePath: string = ''): MarkdownFile[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files: MarkdownFile[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath, relativePath))
    } else if (entry.name.endsWith('.md')) {
      const slug = toPosixPath(relativePath).replace(/\.md$/, '')
      files.push({ fullPath, slug })
    }
  }

  return files
}

export function getAllDirectorySlugs(dirPath: string = contentDirectory, basePath: string = ''): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const directories: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const relativePath = toPosixPath(path.join(basePath, entry.name))
    directories.push(relativePath)
    directories.push(...getAllDirectorySlugs(path.join(dirPath, entry.name), relativePath))
  }

  return directories
}

export function getAllWikiPages(): WikiPageMeta[] {
  return sortPages(
    getAllMarkdownFiles().map(({ fullPath, slug }) => {
      const fileContents = fs.readFileSync(fullPath, 'utf8')
      return parseWikiMeta(slug, fileContents)
    })
  )
}

export function getAllWikiRouteSlugs(): string[] {
  const fileSlugs = getAllMarkdownFiles().map((item) => item.slug)
  const directorySlugs = getAllDirectorySlugs()

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

export function getWikiTree(): WikiTreeNode {
  const root: WikiTreeNode = {
    name: 'content',
    slug: '',
    directories: [],
    pages: [],
  }

  const directoryMap = new Map<string, WikiTreeNode>([['', root]])

  for (const directorySlug of getAllDirectorySlugs()) {
    ensureDirectoryNode(root, directoryMap, directorySlug)
  }

  for (const page of getAllWikiPages()) {
    const segments = page.slug.split('/')
    segments.pop()
    const parentSlug = segments.join('/')
    ensureDirectoryNode(root, directoryMap, parentSlug).pages.push(page)
  }

  return sortWikiTree(root)
}

export function getWikiDirectoryData(slug: string): WikiDirectoryData | null {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const tree = getWikiTree()
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

export function isDirectorySlug(slug: string): boolean {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  if (!normalizedSlug) {
    return true
  }

  const directoryPath = path.join(contentDirectory, normalizedSlug)
  return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory()
}

export async function getMarkdownData(slug: string): Promise<MarkdownData> {
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '')
  const fullPath = path.join(contentDirectory, `${normalizedSlug}.md`)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Markdown page not found for slug: ${slug}`)
  }

  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  const processedContent = await remark()
    .use(html)
    .process(content)

  return {
    ...parseWikiMeta(normalizedSlug, fileContents),
    contentHtml: processedContent.toString(),
    frontmatter: data,
  }
}