export type StepState = 'pending' | 'current' | 'done';

export type PageHeaderConfig = {
    variant: 'page';
    title: string;
    subtitle: string;
    backgroundImage: string;
    withStars: boolean;
    fullHeight: boolean;
};

export type BookingHeaderConfig = {
    variant: 'booking';
};

export type HeaderConfig = PageHeaderConfig | BookingHeaderConfig;
