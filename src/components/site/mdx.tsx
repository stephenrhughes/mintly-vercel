import type { MDXComponents } from "mdx/types";
import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";

function MdxLink({ href = "", ...props }: ComponentProps<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) return <Link href={href} {...props} />;
  return <a href={href} rel="noopener" {...props} />;
}

function MdxImage(props: ComponentProps<"img">) {
  const { src, alt = "", width, height } = props;
  if (typeof src !== "string") return null;
  return (
    <Image
      src={src}
      alt={alt}
      width={Number(width) || 1200}
      height={Number(height) || 800}
      sizes="(min-width: 768px) 720px, 100vw"
      className="h-auto w-full rounded-lg"
    />
  );
}

export const mdxComponents: MDXComponents = {
  a: MdxLink,
  img: MdxImage,
  Image: ({ alt, ...props }: ImageProps) => <Image alt={alt} {...props} />,
};
