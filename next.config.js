/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
})
const nextConfig = {
    images: {
        domains:
        ['firebasestorage.googleapis.com']
    }
};

module.exports = withPWA(nextConfig)
