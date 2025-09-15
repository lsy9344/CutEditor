import { useState, useEffect } from 'react';

export interface FontInfo {
  name: string;
  displayName: string;
  fileName: string;
  path: string;
}

export const useFonts = () => {
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // public/font 에서 .ttf 목록을 동적으로 가져오기
  const getPublicTtfList = async (): Promise<string[]> => {
    // 1) manifest 우선: /public/font/fonts.json -> /font/fonts.json 으로 제공됨
    try {
      const res = await fetch('/font/fonts.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // ["A.ttf", "B.ttf"] 형태
          return data.filter((f) => /\.ttf$/i.test(f));
        }
        if (Array.isArray((data as any).files)) {
          return (data as any).files.filter((f: string) => /\.ttf$/i.test(f));
        }
      }
    } catch (_) {
      // 무시하고 다음 방법으로 진행
    }

    // 2) dev 서버에서 디렉터리 인덱스를 제공하는 경우 HTML 파싱 (보조 수단)
    try {
      const res = await fetch('/font/', { cache: 'no-store' });
      if (res.ok) {
        const html = await res.text();
        const matches = Array.from(html.matchAll(/href\s*=\s*"([^"]+\.ttf)"/gi));
        const files = matches
          .map((m) => m[1])
          .map((href) => href.split('/').pop() as string)
          .filter(Boolean);
        if (files.length > 0) return files;
      }
    } catch (_) {
      // 무시
    }

    // 3) 마지막 폴백: 알려진 파일명 (프로젝트에 포함된 기본 폰트)
    return ['GowunBatang-Regular.ttf', 'NanumSquareL.ttf'];
  };

  const loadFontsFromDirectory = async (): Promise<FontInfo[]> => {
    try {
      const fontInfos: FontInfo[] = [];
      const ttfFiles = await getPublicTtfList();

      for (const fileName of ttfFiles) {
        if (!/\.ttf$/i.test(fileName)) continue;
        const url = `/font/${fileName}`;
        const fontName = fileName.replace(/\.ttf$/i, '');

        const source = `url("${encodeURI(url)}")`;
        const fontFace = new FontFace(fontName, source);
        try {
          await fontFace.load();
          document.fonts.add(fontFace);
          fontInfos.push({
            name: fontName,
            displayName: fontName,
            fileName,
            path: url,
          });
        } catch (fontError) {
          console.warn(`Failed to load font ${fileName}:`, fontError);
        }
      }

      return fontInfos;
    } catch (err) {
      throw new Error(`폰트를 불러오는데 실패했습니다: ${err}`);
    }
  };

  useEffect(() => {
    const loadFonts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedFonts = await loadFontsFromDirectory();
        setFonts(loadedFonts);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      } finally {
        setIsLoading(false);
      }
    };

    loadFonts();
  }, []);

  return {
    fonts,
    isLoading,
    error,
    getFontNames: () => fonts.map(font => font.name)
  };
};
