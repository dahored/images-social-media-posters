Create demo brand, accounts, and sample content to showcase the app.

Run the seed script:
```
node scripts/seed-demo.mjs
```

The script will:
1. Check the dev server is running at localhost:3000 (start it first with /start if needed)
2. Create a demo Instagram carousel (hook + value slide)
3. Create a demo Instagram post
4. Skip gracefully if demo content already exists

After seeding, open http://localhost:3000 to see the demo content.
