import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import AppleProviderPackage from 'next-auth/providers/apple';
import GoogleProviderPackage from 'next-auth/providers/google';
import AzureADProviderPackage from 'next-auth/providers/azure-ad';
import NextAuthPackage from 'next-auth';
import { mongoClientPromise } from './mongodb.js';

const AppleProvider = AppleProviderPackage.default || AppleProviderPackage;
const GoogleProvider = GoogleProviderPackage.default || GoogleProviderPackage;
const AzureADProvider = AzureADProviderPackage.default || AzureADProviderPackage;
const { getServerSession } = NextAuthPackage;
const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.AUTH_GOOGLE_ID,
    clientSecret: process.env.AUTH_GOOGLE_SECRET,
    authorization: { params: { scope: 'openid email profile https://www.googleapis.com/auth/calendar.events' } },
  }));
}

if (process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET) {
  providers.push(AppleProvider({
    clientId: process.env.AUTH_APPLE_ID,
    clientSecret: process.env.AUTH_APPLE_SECRET,
  }));
}

if (process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET) {
  providers.push(AzureADProvider({
    clientId: process.env.AUTH_MICROSOFT_ID,
    clientSecret: process.env.AUTH_MICROSOFT_SECRET,
    tenantId: process.env.AUTH_MICROSOFT_TENANT_ID || 'common',
    authorization: { params: { scope: 'openid email profile offline_access Calendars.ReadWrite' } },
  }));
}

export const authOptions = {
  adapter: mongoClientPromise ? MongoDBAdapter(mongoClientPromise, { databaseName: process.env.MONGODB_DB || 'forq' }) : undefined,
  providers,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.userId || token.sub;
      return session;
    },
  },
  pages: { signIn: '/' },
  secret: process.env.AUTH_SECRET,
};

export const getSession = () => getServerSession(authOptions);
