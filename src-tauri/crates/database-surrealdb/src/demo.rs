use crate::models::Person;
use anyhow::Result;
use surrealdb::engine::local::{Db, Mem};
use surrealdb::Surreal;

/// Run the complete SurrealDB demonstration
pub async fn run_surreal_demo() -> Result<()> {
    println!("🚀 SurrealDB Embedded Database Demo");
    println!("=====================================");

    let db = Surreal::new::<Mem>(()).await?;

    // Select namespace and database
    db.use_ns("demo_ns").use_db("demo_db").await?;
    println!("📦 Using namespace: demo_ns, database: demo_db");

    // Create schema
    println!("\n📋 Creating schema...");
    db.query("DEFINE TABLE persons SCHEMAFULL").await?;
    db.query("DEFINE FIELD name ON TABLE persons TYPE string").await?;
    db.query("DEFINE FIELD age ON TABLE persons TYPE number").await?;
    db.query("DEFINE FIELD city ON TABLE persons TYPE string").await?;
    db.query("DEFINE FIELD created_at ON TABLE persons TYPE datetime DEFAULT time::now()")
        .await?;
    println!("✅ Schema created successfully!");

    // Create some sample data
    println!("\n👥 Creating sample data...");

    let people = vec![
        Person {
            id: None,
            name: "Alice Johnson".to_string(),
            age: 28,
            city: "New York".to_string(),
        },
        Person {
            id: None,
            name: "Bob Smith".to_string(),
            age: 34,
            city: "London".to_string(),
        },
        Person {
            id: None,
            name: "Charlie Brown".to_string(),
            age: 22,
            city: "Tokyo".to_string(),
        },
    ];

    for person in people {
        let created: Option<Person> = db.create("persons").content(person.clone()).await?;
        if let Some(created_person) = created {
            println!("➕ Created person: {}", created_person.name);
        }
    }

    // Query all persons
    println!("\n📊 Querying all persons...");
    let all_persons: Vec<Person> = db.select("persons").await?;
    for person in &all_persons {
        println!("👤 {} (age: {}, city: {})", person.name, person.age, person.city);
    }

    // Query with conditions
    println!("\n🔍 Finding persons in Tokyo...");
    let tokyo_persons: Vec<Person> = db.query("SELECT * FROM persons WHERE city = 'Tokyo'").await?.take(0)?;
    for person in tokyo_persons {
        println!("🏙️ {} lives in {}", person.name, person.city);
    }

    // Update a person
    println!("\n✏️ Updating Alice's age...");
    let updated: Option<Person> = db
        .update(("persons", "alice_johnson"))
        .merge(serde_json::json!({ "age": 29 }))
        .await?;
    if let Some(person) = updated {
        println!("✅ Updated {}'s age to {}", person.name, person.age);
    }

    // Delete a person
    println!("\n🗑️ Deleting Charlie...");
    let deleted: Option<Person> = db.delete(("persons", "charlie_brown")).await?;
    if let Some(person) = deleted {
        println!("❌ Deleted {}", person.name);
    }

    // Show final count
    let final_count: Vec<Person> = db.select("persons").await?;
    println!("\n📈 Final count: {} persons remaining", final_count.len());

    // Database info
    println!("\nℹ️ Database Information:");
    let mut response = db.query("INFO FOR DB").await?;
    let info: Option<serde_json::Value> = response.take(0)?;
    if let Some(info_value) = info {
        println!("Database info: {}", serde_json::to_string_pretty(&info_value)?);
    }

    println!("\n🎉 SurrealDB Embedded Demo Complete!");
    println!("Database file saved at: ./demo_database.db");

    Ok(())
}

/// Initialize database with schema only
pub async fn initialize_database() -> Result<Surreal<Db>> {
    let db = Surreal::new::<Mem>(()).await?;
    db.use_ns("demo_ns").use_db("demo_db").await?;

    // Create schema
    db.query("DEFINE TABLE persons SCHEMAFULL").await?;
    db.query("DEFINE FIELD name ON TABLE persons TYPE string").await?;
    db.query("DEFINE FIELD age ON TABLE persons TYPE number").await?;
    db.query("DEFINE FIELD city ON TABLE persons TYPE string").await?;
    db.query("DEFINE FIELD created_at ON TABLE persons TYPE datetime DEFAULT time::now()")
        .await?;

    Ok(db)
}

/// Add a person to the database
pub async fn add_person(db: &Surreal<Db>, name: String, age: u32, city: String) -> Result<Person> {
    let person = Person {
        id: None,
        name,
        age,
        city,
    };

    let created: Option<Person> = db.create("persons").content(person.clone()).await?;

    if let Some(created_person) = created {
        Ok(created_person)
    } else {
        Err(anyhow::anyhow!("Failed to create person"))
    }
}

/// Query all persons
pub async fn get_all_persons(db: &Surreal<Db>) -> Result<Vec<Person>> {
    let persons: Vec<Person> = db.select("persons").await?;
    Ok(persons)
}

/// Query persons by city
pub async fn get_persons_by_city(db: &Surreal<Db>, city: &str) -> Result<Vec<Person>> {
    let mut response = db
        .query("SELECT * FROM persons WHERE city = $city")
        .bind(("city", city.to_string()))
        .await?;
    let persons: Option<Vec<Person>> = response.take(0)?;
    Ok(persons.unwrap_or_default())
}
