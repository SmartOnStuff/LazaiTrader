import os
import re
from langchain_community.document_loaders.github import GithubFileLoader
from telegram import Update
from telegram.ext import Application, CallbackContext, MessageHandler, filters
from alith import Agent, MilvusStore, chunk_text, WindowBufferMemory, Agent
from dotenv import load_dotenv
import pathlib

# --------------------------------------------
# Constants
# --------------------------------------------
# Load environment variables
BASE_PATH = pathlib.Path(__file__).parent.parent  # adjust as needed
load_dotenv(dotenv_path=BASE_PATH / ".env")

# Get bot token
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN_ALITH")
GITHUB_ACCESS_KEY = os.getenv("GITHUB_ACCESS_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")

GITHUB_REPO = "smartonstuff/LazaiTrader"
DOC_RELATIVE_PATH = "docs"

# --------------------------------------------
# Init Document Database
# --------------------------------------------
def create_vector_store():
    raw_docs = GithubFileLoader(
        repo=GITHUB_REPO,
        access_token=GITHUB_ACCESS_KEY,
        github_api_url="https://api.github.com",
        file_filter=lambda file_path: re.match(
            f"{DOC_RELATIVE_PATH}/.*\\.mdx?", file_path
        ) is not None,
    ).load()
    
    text_chunks = []
    for doc in raw_docs:
        print(doc.metadata.get('source', 'unknown'))  # Debug: Print source of each document
        # Ensure doc.page_content is a string and not empty
        if not doc.page_content or not isinstance(doc.page_content, str):
            print(f"Skipping document with invalid content: {doc.metadata.get('source', 'unknown')}")
            continue
            
        # Clean the content
        content = doc.page_content.strip()
        if len(content) < 10:  # Skip very short documents
            print(f"Skipping very short document: {doc.metadata.get('source', 'unknown')}")
            continue
            
        try:
            chunks = chunk_text(content, overlap_percent=0.2)
            for chunk in chunks:
                # Ensure chunk is a string and not empty
                if isinstance(chunk, str) and chunk.strip():
                    # Add the clean text directly to our list
                    clean_chunk = chunk.strip()
                    # Additional validation to ensure it's a proper string
                    if len(clean_chunk) > 0 and isinstance(clean_chunk, str):
                        text_chunks.append(clean_chunk)
                else:
                    print(f"Skipping invalid chunk in document: {doc.metadata.get('source', 'unknown')}")
        except Exception as e:
            print(f"Error chunking document {doc.metadata.get('source', 'unknown')}: {e}")
            continue
    
    if not text_chunks:
        raise ValueError("No valid text chunks found after processing")
    
    # Debug: Print first few characters of each chunk to verify they're strings
    print(f"Successfully processed {len(text_chunks)} text chunks")
    for i, chunk in enumerate(text_chunks[:3]):  # Show first 3 chunks
        print(f"Chunk {i+1} type: {type(chunk)}, length: {len(chunk)}, preview: {repr(chunk[:50])}")
    
    try:
        return MilvusStore().save_docs(text_chunks)
    except Exception as e:
        print(f"Error in MilvusStore.save_docs: {e}")
        print(f"First chunk type: {type(text_chunks[0]) if text_chunks else 'No chunks'}")
        raise

# --------------------------------------------
# Init Alith Agent
# --------------------------------------------
def create_agent():
    try:
        store = create_vector_store()
        return Agent(
            name="Telegram Bot Agent",
            model="deepseek-chat",  # or `deepseek-reasoner` for DeepSeek R1 Model
            api_key=DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com",  # Fixed: added https://
            preamble="""you are the LazaiTrader Support Agent - @LazaiTrader_alithbot for Telegram groups. Be concise and only respond when asked questions.
Key Rules:

Keep responses short and direct
Only answer when users ask questions
Always redirect trading functions to @lazaitrader_bot but support with information and suggestions
Provide brief help on strategies, commands, and troubleshooting

You're a support agent, not a sales agent. Answer helpfully but briefly based on your knowledge.""",
            store=store,
            memory=WindowBufferMemory()
        )
    except Exception as e:
        print(f"Error creating agent: {e}")
        raise

# Create agent instance
agent = create_agent()

# --------------------------------------------
# Init Telegram Bot
# --------------------------------------------
async def handle_message(update: Update, context: CallbackContext) -> None:
    try:
        response = agent.prompt(update.message.text)
        await context.bot.send_message(chat_id=update.effective_chat.id, text=response)
    except Exception as e:
        print(f"Error handling message: {e}")
        await context.bot.send_message(
            chat_id=update.effective_chat.id, 
            text="Sorry, I encountered an error processing your request."
        )

app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))

# Start the bot
if __name__ == "__main__":
    app.run_polling()
