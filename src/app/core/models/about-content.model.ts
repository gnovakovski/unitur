export interface HomeAboutContent {
  title: string;
  paragraphs: string[];
  imageUrl: string;
  stats: Array<{ number: string; label: string }>;
}

export interface MissionCard {
  icon: string;
  title: string;
  description: string;
}

export interface ValueCard {
  icon: string;
  title: string;
  description: string;
}

export interface TimelineItem {
  year: string;
  event: string;
  description: string;
}

export interface AboutPageContent {
  heroTitle: string;
  heroSubtitle: string;
  missionCards: MissionCard[];
  stats: Array<{ number: string; label: string }>;
  storyTitle: string;
  storySubtitle: string;
  storyParagraphs: string[];
  storyImageUrl: string;
  timelineTitle: string;
  timelineSubtitle: string;
  timeline: TimelineItem[];
  valuesTitle: string;
  valuesSubtitle: string;
  values: ValueCard[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPrimaryLabel: string;
  ctaSecondaryLabel: string;
}

export interface SiteAboutContent {
  home: HomeAboutContent;
  about: AboutPageContent;
  updatedAt?: Date;
}

export const DEFAULT_ABOUT_CONTENT: SiteAboutContent = {
  home: {
    title: 'Sobre a Unitur',
    paragraphs: [
      'Somos uma agência especializada em viagens de peregrinação e turismo, com mais de 5 anos de experiência levando pessoas a destinos que transformam vidas.',
      'Nossa missão é proporcionar experiências únicas, com segurança, conforto e um atendimento personalizado do início ao fim da sua jornada.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&h=500&fit=crop',
    stats: [
      { number: '5000+', label: 'Viajantes' },
      { number: '50+', label: 'Destinos' },
      { number: '5', label: 'Anos de experiência' }
    ]
  },
  about: {
    heroTitle: 'Sobre Nós',
    heroSubtitle: 'Servindo com espírito fraterno desde 1995',
    missionCards: [
      {
        icon: 'MIS',
        title: 'Nossa Missão',
        description: 'Servir nossos clientes com espírito fraterno e profissional buscando o bem comum. Proporcionar uma ótima viagem, seja ela de fé, lazer, cultural ou de negócios, atendendo suas expectativas com responsabilidade, ética, transparência e preço justo.'
      },
      {
        icon: 'VIS',
        title: 'Nossa Visão',
        description: 'Ser reconhecida internacionalmente pela qualidade dos serviços prestados, mantendo sempre nossa essência de proximidade e confiança com os clientes.'
      },
      {
        icon: '✝️',
        title: 'Movimento dos Focolares',
        description: 'Possuímos forte vínculo com o Movimento dos Focolares, de origem católica, que tem como carisma a unidade através do diálogo com igrejas cristãs, religiões e cultura contemporânea.'
      }
    ],
    stats: [
      { number: '29+', label: 'Anos de Experiência' },
      { number: '1995', label: 'Fundação' },
      { number: '100%', label: 'Dedicação' },
      { number: 'EdC', label: 'Economia de Comunhão' }
    ],
    storyTitle: 'Nossa História',
    storySubtitle: 'Uma jornada de dedicação e crescimento',
    storyParagraphs: [
      'A UNITUR está presente no mercado desde 1995, quando sucedeu as atividades da RAPTIM no extremo sul do Brasil, uma empresa especializada em passagens de baixo custo para missionários.',
      'Presente no mercado desde 1995, a Unitur adota como premissa básica para sua atuação uma relação de proximidade e confiança com os seus clientes.',
      'Estamos inseridos nas práticas da chamada Economia de Comunhão (EdC), na qual todas as nossas atividades estão baseadas.',
      'Toda viagem precisa ser bem organizada e a UNITUR busca promover, com uma equipe de ótimos profissionais, o planejamento e realização de sua viagem em todas as suas etapas.'
    ],
    storyImageUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop',
    timelineTitle: 'Nossa Trajetória',
    timelineSubtitle: 'Marcos importantes da nossa história',
    timeline: [
      { year: '1995', event: 'Fundação da UNITUR', description: 'Sucedeu as atividades da RAPTIM no extremo sul do Brasil, especializada em passagens para missionários' },
      { year: '2000', event: 'Expansão de Serviços', description: 'Ampliação do atendimento para diversos tipos de público: lazer, negócios e fé' },
      { year: '2010', event: 'Movimento dos Focolares', description: 'Fortalecimento do vínculo com o Movimento dos Focolares e práticas da EdC' },
      { year: '2015', event: 'Alcance Nacional', description: 'Organização de grupos de peregrinação com origem em qualquer região do Brasil' },
      { year: '2024', event: 'Transformação Digital', description: 'Website moderno como ferramenta importante no relacionamento com clientes' }
    ],
    valuesTitle: 'Nossos Valores',
    valuesSubtitle: 'Os pilares que sustentam nosso trabalho',
    values: [
      { icon: 'FAM', title: 'Somos uma Família', description: 'Acima de tudo, valorizamos as relações humanas e tratamos cada cliente como parte da nossa família.' },
      { icon: 'MUN', title: 'Bem Comum', description: 'Promovemos o bem comum e a união entre os povos através de nossas viagens e serviços.' },
      { icon: 'PAR', title: 'Economia de Comunhão', description: 'Realizamos as práticas da EdC, compartilhando recursos e promovendo justiça social.' },
      { icon: '✝️', title: 'Espírito Fraterno', description: 'Servimos com espírito fraterno e profissional, buscando sempre o melhor para nossos clientes.' }
    ],
    ctaTitle: 'Pronto para sua próxima aventura?',
    ctaSubtitle: 'Entre em contato conosco e descubra como podemos tornar sua viagem dos sonhos realidade.',
    ctaPrimaryLabel: 'Fale Conosco',
    ctaSecondaryLabel: 'Ver Pacotes'
  }
};
