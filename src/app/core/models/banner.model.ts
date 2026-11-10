export interface Banner {
  id: number;
  imageUrl: string;
  /** Arte vertical opcional usada em telas pequenas. O link é o mesmo da versão desktop. */
  imageUrlMobile?: string;
  /**
   * Versões da arte desktop em várias larguras, no formato do atributo `srcset`
   * ("url 1280w, url 1920w, ..."). O site só usa se contiver a `imageUrl` atual,
   * então uma lista antiga nunca mostra uma arte que já foi trocada.
   */
  imageSrcset?: string;
  /** Igual a `imageSrcset`, para a arte de celular (precisa conter `imageUrlMobile`). */
  imageMobileSrcset?: string;
  link?: string;
  buttonText?: string;
  order: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}
