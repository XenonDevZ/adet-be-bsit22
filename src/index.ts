import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import postsRoute from './routes/posts.route';
import { cors } from 'hono/cors';

const app = new Hono()

app.use(cors({
  origin: 'http://localhost:4200',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.get('/', (c) => {
  return c.text('Hello Hono!')
});

app.route('/posts', postsRoute);

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
