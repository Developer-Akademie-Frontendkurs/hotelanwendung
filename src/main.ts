import './style.css';
import Home from './views/HomeView/Home';
import Posts from './views/PostsView/Posts';
import SinglePost from './views/PostsView/SinglePostView/SinglePost';
import About from './views/AboutView/About';
import AdminDashboard from './views/admin/AdminDashboardView/AdminDashboard';
import AdminPosts from './views/admin/AdminPostsView/AdminPosts';
import { Route } from './router/router.interface';
import { Router } from './router/router';

const layoutWrapper: HTMLElement | null = document.getElementById('layout-wrapper');

const routes: Route[] = [
    {
        path: '/',
        kind: 'static',
        view: Home,
    },
    {
        path: '/posts',
        kind: 'static',
        view: Posts,
    },
    {
        path: '/posts/:id',
        kind: 'dynamic',
        view: SinglePost,
    },
    {
        path: '/about',
        kind: 'static',
        view: About,
    },
    {
        path: '/admin',
        kind: 'static',
        view: AdminDashboard,
    },
    {
        path: '/admin/posts',
        kind: 'static',
        view: AdminPosts,
    },
];

const router = new Router(routes, layoutWrapper);
await router.init();
