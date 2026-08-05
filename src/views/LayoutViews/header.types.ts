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
    activeStep: 1 | 2 | 3;
};

export type HeaderConfig = PageHeaderConfig | BookingHeaderConfig;
