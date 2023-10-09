import { Image, Parent, Root } from 'mdast';
import { MdxjsEsm, MdxJsxTextElement } from 'mdast-util-mdx';
import { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import { dirname, resolve, basename, extname, join, sep } from 'path';

export interface RemarkMdxImagesOptions {
  /**
   * By default imports are resolved relative to the markdown file. This matches default markdown
   * behaviour. If this is set to false, this behaviour is removed and URLs are no longer processed.
   * This allows to import images from `node_modules`. If this is disabled, local images can still
   * be imported by prepending the path with `./`.
   *
   * @default true
   */
  resolve?: boolean;
}

// eslint-disable-next-line unicorn/no-unsafe-regex
const urlPattern = /^(https?:)?\//;
const relativePathPattern = /\.\.?\//;

/**
 * A Remark plugin for converting Markdown images to MDX images using imports for the image source.
 */
const remarkMdxImages: Plugin<[RemarkMdxImagesOptions?], Root> =
  ({ resolve = true } = {}) =>
  (ast, file: any) => {
    const imports: MdxjsEsm[] = [];
    const imported = new Map<string, string>();

    visit(ast, 'image', (node: Image, index: number | null, parent: Parent | null) => {
      let { alt = null, title, url } = node;
      if (urlPattern.test(url)) {
        return;
      }
      if (!relativePathPattern.test(url) && resolve) {
        // url = `./${url}`;

        url = './' + [
          'data',
          file?.data?.rawDocumentData?.sourceFileDir,
          url,
        ].join('/')

        // new url: './data/blog/hugo/rename-hugo-blog-git-repo-branch-from-master-to-main/github-set-dft-branch-to-main.png', 
        // cwd: '/home/ttys3/repo/blog/ttys3.dev', dirname: '/home/ttys3/repo/blog/ttys3.dev', 
        // path: '/home/ttys3/repo/blog/ttys3.dev/_mdx_bundler_entry_point-691a69a2-2bfc-404a-99ad-24f209e4e8fc.mdx'
        // console.log('new url: %o, cwd: %o, dirname: %o, path: %o', url, file.cwd, file.dirname, file.path)
      }

      let name = imported.get(url);
      if (!name) {
        name = `__${imported.size}_${url.replace(/\W/g, '_')}__`;

        imports.push({
          type: 'mdxjsEsm',
          value: '',
          data: {
            estree: {
              type: 'Program',
              sourceType: 'module',
              body: [
                {
                  type: 'ImportDeclaration',
                  source: { type: 'Literal', value: url, raw: JSON.stringify(url) },
                  specifiers: [
                    {
                      type: 'ImportDefaultSpecifier',
                      local: { type: 'Identifier', name },
                    },
                  ],
                },
              ],
            },
          },
        });
        imported.set(url, name);
      }

      const textElement: MdxJsxTextElement = {
        type: 'mdxJsxTextElement',
        name: 'img',
        children: [],
        attributes: [
          { type: 'mdxJsxAttribute', name: 'alt', value: alt },
          {
            type: 'mdxJsxAttribute',
            name: 'src',
            value: {
              type: 'mdxJsxAttributeValueExpression',
              value: name,
              data: {
                estree: {
                  type: 'Program',
                  sourceType: 'module',
                  comments: [],
                  body: [{ type: 'ExpressionStatement', expression: { type: 'Identifier', name } }],
                },
              },
            },
          },
        ],
      };
      if (title) {
        textElement.attributes.push({ type: 'mdxJsxAttribute', name: 'title', value: title });
      }
      parent!.children.splice(index!, 1, textElement);
    });
    ast.children.unshift(...imports);
  };

export default remarkMdxImages;
