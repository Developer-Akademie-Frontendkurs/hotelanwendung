import './style.css';
import { HomeView } from './views/HomeView/Home';
import { PostsView } from './views/PostsView/Posts';
import { SinglePostView } from './views/PostsView/SinglePostView/SinglePost';
import { AboutView } from './views/AboutView/About';
import { BookingView } from './views/BookingView/Booking';
import { AdminDashboardView } from './views/admin/AdminDashboardView/AdminDashboard';
import { AdminPostsView } from './views/admin/AdminPostsView/AdminPosts';
import { Route } from './router/router.interface';
import { Router } from './router/router';

const layoutWrapper: HTMLElement | null = document.getElementById('layout-wrapper');

const routes: Route[] = [
    {
        path: '/',
        kind: 'static',
        view: HomeView,
    },
    {
        path: '/posts',
        kind: 'static',
        view: PostsView,
    },
    {
        path: '/posts/:id',
        kind: 'dynamic',
        view: SinglePostView,
    },
    {
        path: '/about',
        kind: 'static',
        view: AboutView,
    },
    {
        path: '/buchung',
        kind: 'static',
        view: BookingView,
    },
    {
        path: '/admin',
        kind: 'static',
        view: AdminDashboardView,
    },
    {
        path: '/admin/posts',
        kind: 'static',
        view: AdminPostsView,
    },
];

const router = new Router(routes, layoutWrapper);
await router.init();
